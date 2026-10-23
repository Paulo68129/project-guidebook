---
sessionId: session-261019-210759-11i6
---

# Requirements

### Overview & Goals

Integrate the Loja Online (e-commerce) with the existing PDV/Delivery system so that online orders flow seamlessly into the PDV workflow, with automatic PIX payments via Enviare, real-time stock deduction, and customer order tracking.

### Current State

The project already has:
- **Loja Online** (`/loja`) — product catalog, cart, checkout, order creation into `pedidos_online`
- **Payment page** (`/pagamento/$vendaId`) — static PIX QR code generation via `pix.ts`
- **PDV** (`/pdv`) — point of sale using `registrar_venda` RPC → inserts into `vendas` table
- **Delivery** (`/delivery`) — unified Kanban board showing both `vendas` (delivery type) and `pedidos_online`
- **OrderBell** — real-time notifications listening to `vendas` table via Supabase Realtime
- **Dashboard** — metrics from `vendas` table only

### Key Gaps

1. Online orders are stored in `pedidos_online` but **never synced to `vendas`** — PDV doesn't get real-time notifications
2. **No stock deduction** for online orders — `registrar_venda` deducts stock, but `criar_pedido_online` doesn't
3. **Static PIX QR code** — no payment confirmation, no webhook, no automatic status updates
4. **Dashboard doesn't show online metrics** — only reads from `vendas`
5. **No customer order tracking page** — customers can't check their order status after payment
6. **No Enviare integration** — current PIX flow is client-side EMV payload only

### User Stories

1. As a **customer**, I want to buy products online and pay via PIX so I can receive my order at home.
2. As a **customer**, I want to track my order status in real-time so I know when it will arrive.
3. As a **PDV operator**, I want to receive online orders in real-time so I can start preparing them immediately.
4. As a **manager**, I want to see online sales metrics in the dashboard so I can monitor performance.
5. As the **system**, I want to automatically deduct stock when a payment is confirmed so inventory stays accurate.

### Functional Requirements

#### 1. PIX Payment via Enviare
- Replace static PIX QR code with Enviare-generated QR code
- Create payment via Enviare API when order is placed
- Receive webhook on payment confirmation
- Update order status automatically: `aguardando_pagamento` → `pago`
- Store transaction ID and payment details in `pedidos_online`

#### 2. Online Order → PDV Sync
- When payment is confirmed, create a corresponding record in `vendas` table (type: `online`)
- This triggers the existing OrderBell notification automatically
- Online orders appear in the delivery Kanban board with an "Online" badge

#### 3. Automatic Stock Deduction
- When payment is confirmed, deduct stock for ordered products (same logic as `registrar_venda`)
- Record stock movements in `ingredientes` table

#### 4. Customer Order Tracking
- New page `/rastrear` where customers enter their order token or phone
- Real-time status display: Aguardando Pagamento → Pago → Em Preparação → Saiu para Entrega → Concluído
- Timeline with timestamps

#### 5. Dashboard — Online Metrics
- Add online sales stats to the dashboard
- Vendas Loja Online, Pedidos em Aberto, Ticket Médio Online, Faturamento Online
- Products mais vendidos (including online orders)

#### 6. Enhanced Payment Page
- Show Enviare PIX QR code instead of static EMV
- Real-time payment status polling
- Auto-redirect to tracking page when payment is confirmed
- PIX Copia e Cola from Enviare

### Out of Scope
- Credit card payments (PIX only for now)
- Refund processing
- Multi-merchant support

# Technical Design

### Current Architecture

```
graph LR
    A[Loja Online /loja] -->|criarPedidoOnline| B[pedidos_online table]
    B -->|polling| C[Delivery /delivery]
    D[PDV /pdv] -->|registrar_venda RPC| E[vendas table]
    E -->|Supabase Realtime| F[OrderBell]
    E -->|query| G[Dashboard]
    B -.no sync.-> E
```

**Problem**: `pedidos_online` and `vendas` are disconnected. Online orders never trigger PDV notifications or stock deduction.

### Target Architecture

```
graph LR
    A[Loja Online /loja] -->|criarPedidoOnline| B[pedidos_online table]
    B -->|Enviare API| C[Enviare PIX Gateway]
    C -->|webhook| D[Supabase Edge Function]
    D -->|update status| B
    D -->|insert venda| E[vendas table]
    D -->|deduct stock| H[ingredientes table]
    E -->|Supabase Realtime| F[OrderBell]
    E -->|query| G[Dashboard]
    B -->|polling| I[Tracking /rastrear]
    B -->|polling| J[Delivery /delivery]
```

### Key Decisions

1. **Enviare as PIX gateway** — User selected Enviare for automatic payment confirmation via webhooks. The flow: create payment → get QR code → webhook on confirmation → update order status.

2. **Supabase Edge Function for webhooks** — Enviare webhooks need a public endpoint. A Supabase Edge Function will receive the webhook, verify the signature, and update the database (order status + create venda record + deduct stock).

3. **Sync to `vendas` on payment confirmation** — Instead of modifying the existing `registrar_venda` RPC, the Edge Function will insert a new record into `vendas` with `tipo = 'online'` when payment is confirmed. This leverages the existing OrderBell and delivery infrastructure.

4. **Stock deduction in Edge Function** — Reuse the same recipe-based stock deduction logic that `registrar_venda` uses, but execute it from the Edge Function after payment confirmation.

5. **Order status mapping** — `pedidos_online.status` values map to delivery columns:
   - `aguardando_pagamento` → not shown in delivery yet
   - `pago` → "Novos" column
   - `preparo` → "Em preparo"
   - `saiu` → "Saiu para entrega"
   - `entregue` → "Entregues"

### Proposed Changes

#### Database Changes (`supabase/migrations/0002_online_payment.sql`)

**Extend `pedidos_online` table:**
- Add columns: `status_pagamento` (text), `origem` (text, default 'loja_online'), `qr_code_pix` (text), `pix_copia_cola` (text), `transaction_id` (text), `updated_at` (timestamptz)
- Add `motoboy_id` column if not already present (it is in the migration but not in types)

**New function `confirmar_pagamento_online`:**
- PL/pgSQL function that: (1) updates `pedidos_online` status to 'pago', (2) inserts a record into `vendas` with `tipo = 'online'`, (3) inserts items into `venda_itens`, (4) deducts stock from `ingredientes` using `receitas`, (5) returns the venda ID
- Uses `pg_advisory_xact_lock` to prevent double-processing

**RLS policies:**
- Allow `anon` to select `pedidos_online` by token (for tracking)
- Allow `authenticated` staff to update `pedidos_online`

#### New Files

1. **`src/lib/enviare.ts`** — Enviare API client
   - `createPixPayment(amount, description, referenceId, expiresInSeconds)` → returns `{ qrCode, pixCopiaCola, transactionId }`
   - Uses `createServerFn` for server-side calls (API key stays server-side)

2. **`src/routes/rastrear.tsx`** — Customer order tracking page
   - Form to enter order token or phone number
   - Real-time status display with timeline
   - Polls `consultarPedidoOnline` every 10 seconds

3. **`supabase/functions/pix-webhook/index.ts`** — Supabase Edge Function
   - Receives POST from Enviare webhook
   - Verifies webhook signature
   - Calls `confirmar_pagamento_online` to sync order to vendas and deduct stock
   - Updates `pedidos_online` with payment details

4. **`supabase/migrations/0002_online_payment.sql`** — Database migration

#### Modified Files

1. **`src/lib/loja-online.functions.ts`** — `criarPedidoOnline`
   - After creating the order, call Enviare API to create PIX payment
   - Store QR code, copia e cola, and transaction ID in `pedidos_online`
   - Return payment data to the frontend

2. **`src/routes/pagamento/$vendaId.tsx`** — Payment page
   - Use Enviare QR code instead of static EMV payload
   - Add real-time status polling
   - Auto-redirect to tracking page when payment confirmed

3. **`src/lib/pix.ts`** — Keep for fallback, add Enviare-specific functions

4. **`src/routes/_authenticated/dashboard.tsx`** — Dashboard
   - Add online sales metrics (faturamento online, pedidos online, ticket médio online)
   - Include online orders in "mais vendidos" ranking

5. **`src/components/OnlineOrders.tsx`** — Update to show payment status

6. **`src/components/OrderBell.tsx`** — Already listens to `vendas`, will work automatically once online orders create venda records

7. **`src/routes/_authenticated/delivery.tsx`** — Already handles online orders, minor updates for new status values

8. **`src/integrations/supabase/types.ts`** — Update types for new columns

### Data Model Changes

**`pedidos_online` (extended):**
```
+ id (uuid, PK)
+ token (uuid, UNIQUE)
+ cliente (text)
+ telefone (text)
+ endereco (text)
+ itens (jsonb)
+ subtotal (numeric)
+ desconto (numeric)
+ taxa_entrega (numeric)
+ total (numeric)
+ cupom (text)
+ status (text) — pedido status: pago, preparo, saiu, entregue, cancelado
+ status_pagamento (text) — NEW: aguardando, pago, expirado, reembolsado
+ origem (text) — NEW: default 'loja_online'
+ qr_code_pix (text) — NEW: Enviare QR code
+ pix_copia_cola (text) — NEW: Enviare copia e cola
+ transaction_id (text) — NEW: Enviare transaction ID
+ motoboy_id (uuid)
+ created_at (timestamptz)
+ updated_at (timestamptz) — NEW
```

**`vendas` (new records with tipo='online'):**
```
+ id (uuid, PK)
+ numero (serial)
+ tipo (text) — 'balcao', 'delivery', or 'online' (NEW)
+ cliente (text)
+ telefone (text)
+ endereco (text)
+ subtotal (numeric)
+ desconto (numeric)
+ taxa_entrega (numeric)
+ total (numeric)
+ custo (numeric) — calculated from receitas
+ lucro (numeric)
+ status (text) — novo, preparo, saiu, entregue, cancelado
+ cupom (text)
+ motoboy_id (uuid)
+ criado_por (text) — 'loja_online'
+ created_at (timestamptz)
```

### Risks

1. **Double payment processing** — Mitigated by `pg_advisory_xact_lock` in `confirmar_pagamento_online` and idempotency check on `transaction_id`.

2. **Webhook delivery failures** — Enviare retries webhooks. The Edge Function is idempotent. Fallback: manual confirmation button in the delivery panel.

3. **Enviare API downtime** — Fallback to static PIX QR code (existing `pix.ts` flow) if Enviare is unavailable.

4. **Stock race conditions** — `confirmar_pagamento_online` runs in a single transaction, so stock deduction is atomic with venda creation.

# Testing

### Validation Approach

The implementation will be validated by verifying each integration point works correctly:

1. **Database migration** — Verify new columns and functions exist in Supabase
2. **Enviare integration** — Test PIX payment creation in sandbox mode
3. **Webhook handling** — Simulate webhook delivery to Edge Function
4. **Order sync** — Verify venda record creation after payment confirmation
5. **Stock deduction** — Verify ingredientes quantities are updated
6. **Real-time notifications** — Verify OrderBell triggers for online orders
7. **Customer tracking** — Verify tracking page shows correct status
8. **Dashboard metrics** — Verify online sales appear in dashboard

### Key Scenarios

1. **Full order flow**: Customer adds items → checkout → payment page → pays via PIX → webhook confirms → PDV notified → stock deducted → customer tracks order
2. **Payment timeout**: Customer doesn't pay within time limit → order stays in `aguardando_pagamento`
3. **Multiple simultaneous orders**: Two customers pay at the same time → both processed correctly without stock conflicts
4. **Double webhook**: Enviare sends the same webhook twice → only first is processed (idempotency)

### Edge Cases

- Product becomes inactive between order creation and payment confirmation
- Stock insufficient when payment is confirmed (order should be cancelled or flagged)
- Webhook arrives before the order is fully created in the database
- Customer enters wrong token on tracking page

# Delivery Steps

### ✓ Step 1: Database migration and payment confirmation function
Extend `pedidos_online` table and create the `confirmar_pagamento_online` function.
- Create `supabase/migrations/0002_online_payment.sql`
- Add columns to `pedidos_online`: `status_pagamento`, `origem`, `qr_code_pix`, `pix_copia_cola`, `transaction_id`, `updated_at`
- Create `confirmar_pagamento_online` PL/pgSQL function: updates order status, inserts into `vendas` with `tipo='online'`, inserts `venda_itens`, deducts stock from `ingredientes` via `receitas`
- Add RLS policies for anon tracking access
- Add index on `pedidos_online.transaction_id` for webhook lookups
- Update `src/integrations/supabase/types.ts` with new columns

### ✓ Step 2: Enviare PIX integration layer
Add Enviare API client and integrate PIX payment creation into the order flow.
- Create `src/lib/enviare.ts` with `createPixPayment` server function
- Update `src/lib/loja-online.functions.ts` — after creating order, call Enviare to generate PIX payment, store QR code and transaction ID in `pedidos_online`
- Update payment page `src/routes/pagamento/$vendaId.tsx` to use Enviare QR code instead of static EMV payload
- Add real-time status polling on payment page
- Auto-redirect to tracking page when payment is confirmed
- Keep static PIX as fallback if Enviare is unavailable

### ✓ Step 3: Supabase Edge Function for PIX webhook
Create the webhook handler that receives payment confirmation from Enviare.
- Create `supabase/functions/pix-webhook/index.ts`
- Verify webhook signature from Enviare
- Call `confirmar_pagamento_online` to sync order to vendas and deduct stock
- Update `pedidos_online` with payment confirmation details
- Handle idempotency: skip if `transaction_id` already processed
- Deploy Edge Function and configure webhook URL in Enviare dashboard

### ✓ Step 4: Customer order tracking page
Add a public page where customers can track their order status in real-time.
- Create `src/routes/rastrear.tsx`
- Form to enter order token or phone number
- Real-time status display with timeline: Aguardando Pagamento → Pago → Em Preparação → Saiu para Entrega → Concluído
- Poll `consultarPedidoOnline` every 10 seconds for status updates
- Show estimated delivery time and delivery data
- Add link from payment page after confirmation and from the home page

### ✓ Step 5: Dashboard online metrics and final integration
Add online sales metrics to the dashboard and finalize the integration.
- Update `src/routes/_authenticated/dashboard.tsx` to include online metrics: Vendas Loja Online, Pedidos em Aberto, Ticket Médio Online, Faturamento Online
- Include online orders in "mais vendidos" ranking
- Update `src/components/OnlineOrders.tsx` to show payment status and origin badge
- Verify OrderBell triggers for online orders (automatic via vendas sync)
- Verify delivery Kanban shows online orders with correct status mapping
- Add "Loja Online" link to the home page hero section
- Update Supabase types and regenerate type definitions

### ✓ Step 6: Production fixes and TypeScript error resolution
Fix all remaining issues for production readiness.
- Add ENVIARE_API_KEY, ENVIARE_MERCHANT_ID, ENVIARE_WEBHOOK_SECRET to .env
- Fix TypeScript errors in loja-online.functions.ts (product type inference, ServerFn data)
- Fix TypeScript errors in delivery.tsx (numero type, motoboy_id type)
- Fix TypeScript errors in loja.tsx (ServerFn data parameter)
- Verify all database migrations are correct and idempotent
- Ensure webhook Edge Function is production-ready
- Validate the complete order flow end-to-end