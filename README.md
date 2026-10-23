# 🍕 PizzaStockAI

**Sistema Inteligente de Gestão para Pizzarias**

Estoque • PDV • Delivery • PIX • Loja Online • Financeiro • Business Intelligence • IA

![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.168-ef4444)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-backend-3ecf8e?logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4-6e9f18?logo=vitest&logoColor=white)

> *"Forno aceso, números na mão."* Menos desperdício, nenhuma ruptura no pico e compras guiadas por previsão de demanda.

Uma plataforma completa para gerenciamento de pizzarias, integrando estoque, produção, vendas, delivery, financeiro e inteligência de negócios em uma única solução moderna e escalável.

---

## 🚀 Demo e Apresentação

### 🌐 Demo Online v1 teste

[Acesse o Demo](https://v0-pizza-stockai.vercel.app/)
[Acesse a Loja Online](https://project-guidebook.vercel.app/loja)

### 🎥 Vídeo Demonstração v2 OFC 

[Assista no Instagram](https://www.instagram.com/paulo_roberto_dev/reel/DeqPM3-BzjU/)

### 📦 Pedido Real Validado

| Detalhe | Valor |
|---|---|
| **Ficha** | #121 |
| **Data** | 16/10/2026 |
| **Valor** | R$ 66,90 |
| **Pagamento** | PIX QR Code válido |

---

## Sumário

- [🚀 Demo e Apresentação](#-demo-e-apresentação)
- [📖 Visão geral](#visão-geral)
- [🎯 Problema Resolvido](#problema-resolvido)
- [📈 Evolução do Projeto](#evolução-do-projeto)
- [✨ Funcionalidades](#funcionalidades)
- [💳 Pagamento PIX](#pagamento-pix)
- [🔍 Rastreamento de Pedidos](#rastreamento-de-pedidos)
- [🔔 Integração Loja Online → Delivery](#integração-loja-online--delivery)
- [⭐ Sistema de Avaliações e Feedbacks](#sistema-de-avaliações-e-feedbacks)
- [📊 Métricas do Projeto](#métricas-do-projeto)
- [🤝 Casos de Uso](#casos-de-uso)
- [⭐ Diferenciais Competitivos](#diferenciais-competitivos)
- [🏗 Stack tecnológica](#stack-tecnológica)
- [🏗 Arquitetura](#arquitetura)
- [🔄 Fluxo de Pedido](#fluxo-de-pedido)
- [📁 Rotas da aplicação](#rotas-da-aplicação)
- [📁 Modelo de dados](#modelo-de-dados)
- [🔒 Perfis e permissões](#perfis-e-permissões)
- [🤖 Previsão de demanda](#previsão-de-demanda)
- [🛠 Primeiros passos](#primeiros-passos)
- [📜 Scripts disponíveis](#scripts-disponíveis)
- [📁 Estrutura de pastas](#estrutura-de-pastas)
- [🎨 Design system](#design-system)
- [🚀 Build e deploy](#build-e-deploy)
- [🔒 Segurança](#segurança)
- [📝 Convenções de código](#convenções-de-código)
- [🛣 Roadmap](#roadmap)
- [👨‍💻 Equipe](#equipe)
- [🤝 Agradecimentos](#agradecimentos)
- [📜 Licença](#licença)

---

## 📖 Visão geral

O PizzaStockAI nasceu para resolver um dos maiores problemas enfrentados por pizzarias: **a falta de integração entre estoque, vendas, produção, delivery e financeiro**.

Muitos estabelecimentos utilizam planilhas, anotações manuais e sistemas isolados, criando retrabalho, desperdícios e perda de lucratividade.

O projeto centraliza toda a operação em uma única plataforma web full-stack (SSR), permitindo acompanhamento em tempo real das atividades da empresa:

- controla **ingredientes**, validade e estoque mínimo;
- calcula o **custo e a margem** de cada produto a partir da ficha técnica;
- registra vendas de **balcão e delivery** com baixa automática de insumos;
- acompanha pedidos em um **quadro kanban** de delivery com atualizações em tempo real;
- apresenta **indicadores financeiros** (faturamento, CMV, lucro, ticket médio);
- sugere **compras** com base em previsão de demanda calculada sobre o histórico de vendas.

---

## 🎯 Problema Resolvido

### ❌ Antes

- ❌ Controle manual de estoque
- ❌ Falta de visão financeira
- ❌ Perda de insumos por validade
- ❌ Ausência de previsões de compra
- ❌ Delivery desconectado do sistema
- ❌ Processos lentos e suscetíveis a erros

### ✅ Depois

- ✅ Operação centralizada
- ✅ Estoque atualizado automaticamente
- ✅ Delivery integrado em tempo real
- ✅ Pagamento PIX com QR Code dinâmico
- ✅ Controle financeiro completo
- ✅ Inteligência para compras
- ✅ Indicadores para tomada de decisão

---

## 📈 Evolução do Projeto

### Versão 1.0

| | |
|---|---|
| **Stack** | Python, SQLAlchemy, SQLite/PostgreSQL, Machine Learning |
| **Limitações** | Comunicação não era em tempo real, PDV apresentava gargalos sob carga, fluxo de delivery dependia de atualizações manuais |

### Versão 2.0 (Atual)

| | |
|---|---|
| **Stack** | React 19, TypeScript, Supabase, PostgreSQL, Realtime, TanStack Query, TanStack Router |
| **Melhorias** | ✅ Atualizações em tempo real, ✅ Melhor experiência do usuário, ✅ Maior desempenho, ✅ Delivery conectado ao painel administrativo, ✅ Sistema preparado para escalabilidade, ✅ Arquitetura orientada a eventos, ✅ Pagamento PIX integrado, ✅ Loja Online completa |

## ✨ Funcionalidades

### 🛒 PDV Inteligente

- Venda Balcão e Venda Delivery
- Carrinho integrado com aplicação de cupons
- Cálculo automático e taxa de entrega
- Impressão térmica 80mm
- Baixa automática do estoque
- Finalização via função atômica no banco (`registrar_venda`)

**Cupom Exemplo:** `BEMVINDO15`

---

### 🛒 Loja Online

**Experiência do Cliente:**
- Catálogo completo com fotos e descrições
- Carrinho de compras interativo
- Formulário de dados para entrega
- Redirecionamento automático para página de pagamento
- Horário de funcionamento exibido em tempo real

**Fluxo Completo:**
```
Montar Carrinho → Inserir Dados → Finalizar Pedido → Pagar via PIX
```

### 🚚 Delivery Online

**Área do Cliente:**
- Link público para pedidos
- Catálogo online com carrinho de compras
- Finalização do pedido com pagamento PIX
- Rastreamento em tempo real via código do pedido

**Gestão de Pedidos:**
- Atualização em tempo real com notificação sonora e alertas visuais
- Controle completo do fluxo com quadro Kanban
- Sincronização automática entre Loja Online e PDV

```
Novos Pedidos → Em Preparo → Saiu para Entrega → Entregue
```

---

### 💳 Pagamento PIX

**PIX Estático (Fallback):**
- Geração automática do QR Code PIX EMV conforme padrão do Banco Central
- Valor fixo da transação no código
- TXID único para rastreamento de cada pagamento
- CRC16-CCITT válido para aceitação pelos apps bancários

**PIX Dinâmico via Enviare (Opcional):**
- Integração com API Enviare para cobranças PIX dinâmicas
- Webhook para confirmação automática de pagamento
- Fallback automático para PIX estático se a API estiver indisponível
- Configuração via variáveis de ambiente (`ENVIARE_API_KEY`, `ENVIARE_MERCHANT_ID`)

**Timer de Pagamento:**
- Tempo limite de 15 minutos para pagamento
- Expiração automática de pedidos não pagos
- Timer regressivo visual (verde → amarelo → vermelho)
- Verificação em tempo real do status de expiração

**Modal de Pagamento:**
- Botão "Copiar código PIX" com feedback visual
- Toggle para mostrar/ocultar o BR Code completo
- Instruções passo a passo de como pagar
- Dados sensíveis mascarados na tela (chave PIX e telefone)

**Confirmação Manual de Pagamento:**
- Proprietário confirma o pagamento manualmente na tela de Delivery
- Botão **"✅ Confirmar Pagamento"** visível quando status é `aguardando_pagamento`
- Função `confirmar_pagamento_online` vincula pedido online ao PDV
- Baixa automática de estoque ao confirmar pagamento
- Registro de auditoria na tabela `pagamentos_online`
- Criação automática de venda no sistema
- Cliente recebe notificação em tempo real via Supabase Realtime

**Aceitação de Pedido:**
- Após confirmar pagamento, botão **"✅ Aceitar Pedido"** aparece destacado
- Pedido é enviado para produção automaticamente
- Status muda: `aguardando_pagamento → pago → recebido → preparando → pronto → em_entrega → finalizado`

**Impressão Térmica:**
- QR Code no cupom para pagamento rápido
- Seção de taxas fiscais (ICMS, PIS, COFINS, ISS)
- Beneficiário exibido como "PizzaStockAI"
- Chave PIX e telefone mascarados para segurança

**Segurança:**
- Nome completo protegido; exibição usa marca da loja
- Chave PIX mascarada: `***.067.907-**`
- Telefone mascarado: `(21) 99319-****`
- QR Code contém dados completos para leitura bancária

---

### 📦 Gestão de Estoque

- Cadastro de produtos com controle de quantidade
- Custo unitário e data de validade
- Estoque mínimo com alertas automáticos
- Entrada de mercadoria e busca

**Indicadores:**
```
Valor em Estoque: R$ 1.180,03
Alerta: Manjericão vence em 1 dia
```

---

### 🍕 Gestão de Cardápio

**Produtos:** Pizzas, Bebidas, Combos, Adicionais

**Ficha Técnica:** Cada item possui ingredientes, quantidades, custos e margem de lucro.

**Exemplo:**
```
Pizza Calabresa
Custo: R$ 12,37
Margem: 79%
```

---

### 💰 Financeiro

- Controle de receitas e despesas
- Fluxo de caixa com períodos de 7, 30 e 90 dias
- Relatórios com exportação CSV

**Indicadores:**
```
Faturamento: R$ 85.975,20
Custos:      R$ 23.143,74
Lucro:       R$ 58.337,46
Ticket Médio: R$ 110,49
```

---

### 📊 Business Intelligence

Dashboards para análise operacional:

- Faturamento e lucro por período
- Ticket médio e vendas por período
- Produtos mais vendidos
- Gráficos, indicadores e relatórios
- Exportação de dados

---

### 🤖 Inteligência de Compras

O sistema utiliza dados históricos para estimar demanda futura e sugerir compras.

**Exemplo:**
```
Mozzarella em estoque: 21,05kg
Consumo previsto:      52,71kg
Sugestão:              Comprar 33,8kg
Investimento estimado: R$ 1.488,59
```

---

### 📋 Resumo dos Módulos

| Módulo | Descrição |
|---|---|
| **Central (Dashboard)** | Faturamento e lucro do dia, deliveries em aberto, alertas de estoque, gráfico de 14 dias e ranking dos 5 produtos mais vendidos (30 dias). |
| **PDV** | Montagem de pedido por toque, alternância Balcão/Delivery, cupom de desconto, taxa de entrega automática e finalização via função atômica no banco (`registrar_venda`). |
| **Loja Online** | Catálogo público com fotos, carrinho interativo, formulário de entrega e redirecionamento para pagamento PIX. |
| **Pagamento PIX** | QR Code EMV válido, timer de 5 minutos, botão copiar código, dados mascarados e taxas fiscais no cupom. |
| **Delivery** | Quadro com colunas *Novos → Em preparo → Saiu para entrega → Entregues*, atribuição de motoboy e cancelamento. Exibe as últimas 48h. |
| **Estoque** | CRUD de ingredientes, busca, entrada de mercadoria, destaque de itens abaixo do mínimo e vencidos, e valor total em estoque. |
| **Cardápio** | Cadastro de produtos com categoria, preço, disponibilidade e **ficha técnica** (receita). Mostra custo e margem (alerta visual abaixo de 30%). |
| **Financeiro** | Períodos de 7, 30 e 90 dias, faturamento, custo, lucro, margem, ticket médio, descontos, gráfico faturamento × lucro e **exportação CSV**. |
| **Previsões** | Projeção de pedidos e faturamento para 7 ou 14 dias, gráfico real × previsto e lista de compras sugerida com valor estimado. |
| **Alertas** | Agrupa ingredientes vencidos, vencendo em até 3 dias, zerados e abaixo do mínimo. |
| **Configurações** | Horário de funcionamento, taxa de entrega, som de alerta para novos deliveries, gestão de motoboys e cupons. |
| **Autenticação** | E-mail/senha e login com Google. O primeiro usuário cadastrado se torna administrador. |

---

## 📊 Métricas do Projeto

| Métrica | Valor |
|---|---|
| **PDV** | < 1,5 segundos |
| **Atualização Realtime** | < 500ms |
| **Arquitetura** | Cloud Native |
| **Banco de Dados** | PostgreSQL |
| **Autenticação** | Google OAuth |
| **Módulos** | Estoque, PDV, Delivery, Financeiro, BI, IA |

---

## 🤝 Casos de Uso

| Perfil | Ações |
|---|---|
| **Cliente** | Fazer pedidos online, acompanhar status, aplicar cupons |
| **Atendente** | Registrar vendas, emitir comprovantes, consultar pedidos |
| **Gerente** | Controlar estoque, visualizar BI, gerar relatórios |
| **Motoboy** | Receber entregas, atualizar status de pedidos |

---

## ⭐ Diferenciais Competitivos

- ✅ Estoque integrado ao PDV
- ✅ Delivery em tempo real
- ✅ Pagamento PIX com QR Code válido
- ✅ Loja Online completa
- ✅ Controle de validade
- ✅ Sugestão inteligente de compras
- ✅ Financeiro integrado
- ✅ Business Intelligence
- ✅ Impressão térmica 80mm
- ✅ Login Google
- ✅ Arquitetura moderna
- ✅ Banco de dados em nuvem

## 🏗 Stack tecnológica

### Frontend

- [TanStack Start](https://tanstack.com/start) (SSR) + [TanStack Router](https://tanstack.com/router) com rotas baseadas em arquivos
- [TanStack Query](https://tanstack.com/query) (`useSuspenseQuery` + `ensureQueryData` nos loaders)
- React 19, TypeScript 5.8 (modo `strict` com flags adicionais)
- Tailwind CSS 4 + `tw-animate-css`
- Componentes baseados em [Radix UI](https://www.radix-ui.com/) (padrão shadcn/ui)
- `lucide-react`, `sonner`, `cmdk`, `vaul`
- Gráficos com [Recharts](https://recharts.org/)
- Formulários: `react-hook-form` + `zod`
- QR Code: `qrcode` para geração de imagens PIX
- Supabase Realtime para atualizações em tempo real

### Backend

- [Supabase](https://supabase.com/) (Auth, Postgres, RPC, Realtime)
- `@supabase/supabase-js`
- `@lovable.dev/cloud-auth-js` para OAuth (Google)
- Nitro como servidor (alvo padrão: Cloudflare no build)
- Integração Enviare para PIX dinâmico (opcional)
- Supabase Edge Functions para webhooks

### Qualidade

- Vitest + Testing Library + jsdom
- ESLint 9 + Prettier

## Arquitetura

```
Navegador ──► TanStack Start (SSR) ──► Nitro
                    │
                    ├── Roteamento por arquivos (src/routes)
                    ├── Loaders pré-carregam dados no QueryClient
                    └── Supabase (Auth + Postgres + RPC)
```

Pontos relevantes:

- **Roteamento por arquivos**: `routeTree.gen.ts` é gerado automaticamente pelo plugin do TanStack Router. **Não edite manualmente.**
- **Contexto do router**: o `QueryClient` é injetado no `context` do router (`src/router.tsx`), permitindo que cada rota use `context.queryClient.ensureQueryData(...)` no `loader`.
- **Rotas protegidas**: o layout `_authenticated` roda com `ssr: false` e, em `beforeLoad`, consulta `supabase.auth.getUser()`; sem usuário, redireciona para `/auth`. Todas as páginas internas são renderizadas dentro do `AppShell`.
- **Servidor**: `vite.config.ts` usa `@lovable.dev/vite-tanstack-config`, que já inclui `tanstackStart`, `viteReact`, `tailwindcss`, `tsconfig-paths`, `nitro` e injeção de variáveis `VITE_*`. A entrada do servidor é redirecionada para `src/server.ts` (wrapper de erros de SSR).
- **Regras de negócio críticas no banco**: o registro de venda é feito pela função RPC `registrar_venda`, que valida e baixa insumos de forma atômica.
- **Tratamento de erros**: cada rota define `errorComponent: RouteError`.
- **SEO**: cada rota declara `head()` com `title`, `description` e tags Open Graph.

---

## 🔄 Fluxo de Pedido

```mermaid
graph LR
    A[Cliente faz pedido] --> B{Via qual canal?}
    B -->|PDV| C[PDV registra venda]
    B -->|Loja Online| D[Pagamento PIX]
    D -->|Pago| E[Confirmação automática]
    E --> C
    C --> F[Baixa automática de estoque]
    F --> G[Atualização em tempo real]
    G --> H[Kanban de delivery]
    H --> I[Preparo → Entrega → Entregue]
```

1. **Cliente** faz o pedido via PDV ou Loja Online
2. **Loja Online**: Cliente paga via PIX (estático ou dinâmico via Enviare)
3. **Confirmação**: Pagamento confirmado automaticamente via webhook ou manualmente
4. **Sistema**: Registra a venda e vincula ao pedido online
5. **Estoque**: Baixa automática conforme ficha técnica
6. **Painel**: Atualização em tempo real via Supabase Realtime
7. **Equipe**: Acompanha o fluxo no Kanban de delivery
8. **Cliente**: Rastreia o pedido em tempo real via código
9. **Financeiro**: Registra receita e custo automaticamente

---

## 📁 Rotas da aplicação

| Caminho | Acesso | Descrição |
|---|---|---|
| `/` | Público | Landing page |
| `/auth` | Público | Login, cadastro e Google OAuth |
| `/loja` | Público | Loja Online - catálogo e carrinho |
| `/pagamento/$vendaId` | Público | Página de pagamento PIX com QR Code |
| `/rastrear` | Público | Rastreamento de pedido por código |
| `/avaliacoes` | Público | Página de avaliações e feedbacks |
| `/dashboard` | Autenticado | Central |
| `/pdv` | Autenticado | Ponto de venda |
| `/delivery` | Autenticado | Quadro de pedidos |
| `/estoque` | Autenticado | Ingredientes |
| `/cardapio` | Autenticado | Produtos e fichas técnicas |
| `/financeiro` | Autenticado | Resultados financeiros |
| `/previsoes` | Autenticado | Previsão e compras |
| `/alertas` | Autenticado | Alertas de estoque |
| `/config` | Autenticado | Configurações da loja |

## 🔍 Rastreamento de Pedidos

Os clientes podem rastrear seus pedidos em tempo real através da página `/rastrear`:

**Funcionalidades:**
- Busca por código do pedido (token único)
- Timeline visual com **7 etapas** do status do pedido
- Atualização automática via Supabase Realtime (sem refresh)
- **Notificações toast** automáticas quando o status muda
- **Banner de notificação** visual com mensagem personalizada para cada status
- Exibição de informações do cliente, endereço e itens
- Cupom fiscal/impressão do pedido (NFCE)
- **Expiração automática**: Pedidos não pagos são removidos após 5 minutos

**Fluxo de Status (7 etapas):**
```
Aguardando Pagamento → Pagamento Confirmado → Pedido Recebido → Preparando → Pronto → Saiu para Entrega → Entregue
```

**Notificações em Tempo Real:**
- ✅ **Pagamento Confirmado**: "Seu pagamento foi confirmado! Aguardando início da preparação."
- 👨‍🍳 **Pedido Aceito**: "Seu pedido foi aceito e já está sendo preparado pela equipe."
- 🍕 **Preparando**: "Sua equipe está preparando seu pedido com carinho!"
- 📦 **Pronto**: "Seu pedido está pronto e será entregue em breve!"
- 🛵 **Saiu para Entrega**: "Seu pedido saiu para entrega! Em breve estará com você."
- ✅ **Entregue**: "Seu pedido foi entregue com sucesso! Bom apetite!"

**Tecnologia:**
- Supabase Realtime para atualizações instantâneas
- Toast notifications automáticas via `sonner`
- Banner visual colorido para cada status
- Polling de fallback a cada 10 segundos
- Integração com sistema de pagamentos PIX
- Timer de expiração de 5 minutos com limpeza automática

---

## 🔔 Fila Unificada de Pedidos (PDV + Delivery + Loja Online)

Todas as origens de venda (PDV, Delivery e Loja Online) compartilham a **mesma fila operacional**, garantindo que qualquer pedido realizado chegue obrigatoriamente ao vendedor/atendente com 100% de confiabilidade.

### 🏪 Origens do Pedido

Cada pedido é identificado pela sua origem:

| Origem | Canal | Tabela | Badge |
|--------|-------|--------|-------|
| **PDV** | Venda presencial | `vendas` | 🟠 Laranja |
| **DELIVERY** | Pedido por telefone/app | `vendas` | 🟢 Verde |
| **LOJA ONLINE** | Loja online (cliente) | `pedidos_online` | 🔵 Azul |

O campo `origem` na tabela `pedidos_online` é automaticamente preenchido como `'loja_online'` pela função `criar_pedido_online()`.

### 📋 Recebimento Automático de Pedidos

- **Loja Online**: Quando um cliente finaliza uma compra, o pedido é criado em `pedidos_online` e aparece instantaneamente no Delivery
- **PDV/Delivery**: Pedidos criados diretamente no sistema aparecem em `vendas` e são exibidos na mesma fila
- A campainha (`OrderBell`) escuta **ambas as tabelas** via Supabase Realtime
- Nenhum pedido é perdido, independentemente da origem
- Sincronização instantânea via **Supabase Realtime**

### 🔊 Alerta Sonoro Unificado

- Ao receber um novo pedido (de qualquer origem), reproduz automaticamente um som de campainha
- O som toca mesmo que o operador esteja em outra aba do sistema
- O alerta é executado apenas uma vez por pedido para evitar repetições
- Opção nas configurações para ativar ou desativar o som
- Implementado via **Web Audio API** para máxima compatibilidade

### 🆔 Identificação Visual por Origem

- Cada card de pedido exibe um **badge colorido** indicando a origem (PDV, DELIVERY, LOJA ONLINE)
- Pedidos da Loja Online incluem informações completas: telefone, endereço, itens com descrições, cupom, observações
- Pedidos do PDV incluem número sequencial da venda
- Horário exato de entrada do pedido visível no card
- Painel de alertas (`OrderBell`) mostra origem de cada pedido com cores distintas

### ⏱️ Expiração Automática (5 minutos)

- Caso o pedido permaneça sem confirmação por **5 minutos**:
  - Status alterado automaticamente para "Expirado"
  - Remoção de todos os dados temporários do rastreamento
  - Limpeza de informações de acompanhamento em tempo real
  - Remoção de registros temporários do mapa e rastreio
  - Encerramento de listeners e subscriptions relacionados

### 🧹 Limpeza Automática de Dados

- Após o status "Expirado":
  - Exclusão de informações temporárias do pedido
  - Exclusão de dados de rastreamento
  - Exclusão de localização em tempo real
  - Exclusão de eventos de notificação relacionados
  - Apenas registros históricos de auditoria permanecem

### 🔄 Sincronização em Tempo Real — Sistema Híbrido

O sistema utiliza um mecanismo híbrido para garantir **100% de confiabilidade** na entrega dos pedidos:

**Canal Principal — Supabase Realtime:**
- Escuta eventos PostgreSQL via WebSocket em tempo real
- Detecta `INSERT`, `UPDATE` e `DELETE` na tabela `pedidos_online`
- Reconnect automático com backoff exponencial (2s, 4s, 8s, max 30s)
- Heartbeat para detectar conexões mortas
- Indicador visual de conexão no painel de delivery (verde = ativo, amarelo = fallback)

**Canal Secundário — Polling Automático (Fallback):**
- Consulta automática a cada **5 segundos** no módulo Delivery
- Garante recebimento de pedidos mesmo se o Realtime falhar
- Busca pedidos com status: `aguardando_pagamento`, `novo`, `pago`
- Continua rodando como redundância mesmo com Realtime ativo

**Fluxo de Recuperação:**
- Ao abrir ou recarregar a tela de Delivery, o sistema busca automaticamente todos os pedidos pendentes
- Restaura notificações e toca alertas sonoros para pedidos não processados
- Nenhum pedido é perdido mesmo após: atualização da página, reinício do navegador, perda de internet, ou falha do Realtime

**Atualização simultânea em:**
- Loja Online
- Delivery
- PDV
- Rastreamento do Cliente
- Painel Administrativo

### 📊 Logs de Auditoria

- Tabela `pedidos_online_audit` registra todas as ações:
  - `recebido`: Quando um novo pedido chega
  - `confirmado`: Quando o pagamento é confirmado
  - `atualizado`: Quando o status muda
  - `expirado`: Quando o pedido expira automaticamente
  - `cancelado`: Quando o pedido é cancelado manualmente
- Trigger automática registra mudanças no banco
- Função RPC `limpar_pedidos_expirados()` executa limpeza a cada 30 segundos

### 🛠️ Implementação Técnica

**Arquivos Principais:**
- `src/components/OrderBell.tsx` - Campainha unificada: escuta `vendas` (PDV) e `pedidos_online` (Loja Online)
- `src/hooks/useNewOrderSound.ts` - Hook de alerta sonoro com Web Audio API
- `src/hooks/useOnlineOrdersRealtime.ts` - Hook de Realtime com reconnect automático
- `src/routes/_authenticated/delivery.tsx` - Fila unificada com badges de origem (PDV/LOJA ONLINE)
- `src/lib/online-order-api.ts` - API de pedidos online (enviar, buscar, aceitar, recusar)
- `src/lib/online-order.ts` - Tipos, normalização e utilitários de pedidos
- `src/hooks/useMyOrders.ts` - Gerenciamento de pedidos rastreados pelo cliente
- `supabase/migrations/0011_consolidated_migrations.sql` - Migração consolidada (Realtime + tracking + origem)

**Funções RPC:**
- `criar_pedido_online()` - Cria pedido com `origem = 'loja_online'` automaticamente
- `limpar_pedidos_expirados()` - Limpa pedidos expirados automaticamente
- `confirmar_pagamento_online(_pedido_id)` - Confirma pagamento e vincula ao PDV
- `aceitar_pedido(_pedido_id)` - Aceita o pedido no delivery
- `recusar_pedido(_pedido_id, _motivo)` - Recusa o pedido com motivo
- `adicionar_rastreamento()` - Registra evento de rastreamento
- `listar_rastreamento(_pedido_id)` - Lista histórico de rastreamento

**Hooks Customizados:**
- `useNewOrderSound()` - Gerencia alertas sonoros com Web Audio API
- `useOnlineOrdersRealtime()` - Subscrição Realtime com reconnect, heartbeat, e logging
- `useMyOrders()` - Gerencia pedidos rastreados localmente pelo cliente

### ⚠️ CONFIGURAÇÃO OBRIGATÓRIA DO BANCO DE DADOS

**Antes de usar o sistema, é necessário aplicar as migrações SQL no banco de dados.**

O sistema utiliza **14 tabelas** para gerenciar pedidos online, pagamentos, auditoria, rastreamento e feedbacks.

#### 🚀 Método 1 — Página de Migrações (Automático, Recomendado)

Após o deploy da aplicação, acesse a página de migrações:

```
https://seu-projeto.vercel.app/apply-migrations?auto=1
```

1. Abra a URL acima no navegador
2. As migrações serão aplicadas automaticamente
3. Aguarde a execução (deve levar ~30 segundos)
4. Verifique se as 14 tabelas foram criadas com sucesso

**Tabelas criadas automaticamente:**
- `produtos`, `ingredientes`, `receitas` — Catálogo e fichas técnicas
- `vendas`, `venda_itens` — Registro financeiro
- `cupons`, `loja_config` — Descontos e configurações
- `pedidos_online`, `pagamentos_online` — Pedidos e pagamentos
- `pedidos_online_audit` — Auditoria de ações
- `rastreamento_pedidos` — Histórico de status
- `notificacoes_delivery` — Notificações do delivery
- `feedback_clientes`, `respostas_feedback` — Avaliações

**Como funciona:** A página usa o cliente admin do Supabase (service_role key) configurado na Vercel para executar as migrações SQL diretamente no banco de dados. Não é necessário acesso ao SQL Editor ou Supabase CLI.

#### 📋 Método 2 — Supabase Dashboard

1. Acesse: https://supabase.com/dashboard/project/lstycewiltrbefrxicdx/sql
2. Copie o conteúdo de: `supabase/migrations/0014_master_setup.sql`
3. Cole no SQL Editor e clique em **RUN**

#### 📋 Método 3 — Supabase CLI (se disponível)

```bash
supabase login
supabase link --project-ref lstycewiltrbefrxicdx
supabase db push
```

#### ✅ Validação após aplicação

Após aplicar as migrações, acesse:

```
https://seu-projeto.vercel.app/check-env
```

Esta página verifica automaticamente:
- ✅ `SUPABASE_URL` configurada
- ✅ `SUPABASE_SERVICE_ROLE_KEY` configurada
- ✅ `SUPABASE_PUBLISHABLE_KEY` configurada
- ✅ Conexão com banco funcionando
- ✅ 14 tabelas presentes

#### 📊 O que a migração faz

O arquivo `0014_master_setup.sql` contém **todas as configurações necessárias** em um único script:

1. **14 tabelas** com todas as colunas, constraints e índices
2. **Funções RPC** — `criar_pedido_online`, `confirmar_pagamento_online`, `aceitar_pedido`, `recusar_pedido`, etc.
3. **Triggers** — Rastreamento automático, notificações, updated_at
4. **RLS** — Políticas de segurança em todas as tabelas
5. **Grants** — Permissões para `anon`, `authenticated` e `service_role`
6. **Realtime** — `REPLICA IDENTITY FULL` para atualizações em tempo real

### ✅ Confirmação de Pagamento e Aceitação de Pedido

Fluxo completo de confirmação manual de pagamento PIX:

1. **Cliente paga via PIX**: Visualiza QR Code e realiza pagamento no app bancário
2. **Proprietário confirma**: Clica em **"✅ Confirmar Pagamento"** na tela de Delivery
   - Venda registrada no financeiro
   - Estoque atualizado automaticamente
   - Status muda para "Pagamento Confirmado"
   - Cliente recebe notificação em tempo real
3. **Proprietário aceita**: Clica em **"✅ Aceitar Pedido"**
   - Pedido enviado para produção
   - Status muda para "Pedido Recebido"
   - Cliente recebe notificação: "Seu pedido foi aceito e já está sendo preparado"
4. **Fluxo de produção**: `recebido → preparando → pronto → em_entrega → finalizado`

**Botões disponíveis no Delivery:**
- ✅ **Confirmar Pagamento** — Visível quando status é `aguardando_pagamento`
- ✅ **Aceitar Pedido** — Visível quando status é `pago` (destaque verde)
- ❌ **Recusar** — Disponível em qualquer momento antes da produção

### 📱 Experiência do Cliente

- **Pagamento confirmado**: Banner verde com "✅ Pagamento Confirmado!"
- **Pedido aceito**: Banner azul com "👨‍🍳 Pedido Aceito"
- **Preparando**: Banner laranja com "🍕 Preparando Pedido"
- **Pronto**: Banner ciano com "📦 Pedido Pronto"
- **Saiu para entrega**: Banner roxo com "🛵 Saiu para Entrega"
- **Entregue**: Banner verde com "✅ Pedido Entregue"
- **Pedido recusado**: Motivo da recusa exibido claramente
- **Pedido entregue**: Botão "Avaliar este pedido" para deixar feedback
- **Notificações toast**: Aparecem automaticamente quando o status muda (sem refresh)
- Atualizações em tempo real via Supabase Realtime
- Interface responsiva para desktop, tablet e smartphone

---

## ⭐ Sistema de Avaliações e Feedbacks

Sistema completo de avaliações onde os clientes podem avaliar seus pedidos após a entrega, com painel administrativo para moderação.

### 📝 Como Funciona

1. **Cliente avalia**: Após o pedido ser entregue, o cliente pode acessar `/avaliacoes` e deixar sua avaliação
2. **Nota de 1 a 5 estrelas**: Sistema de classificação visual com estrelas
3. **Comentário opcional**: Cliente pode deixar um comentário sobre a experiência
4. **Moderação admin**: Avaliações precisam ser aprovadas pelo administrador para serem exibidas publicamente
5. **Resposta da loja**: Administrador pode responder às avaliações

### 📊 Página Pública de Avaliações

- **Estatísticas gerais**: Média de avaliação, total de avaliações, distribuição por estrelas
- **Filtros**: Filtrar avaliações por quantidade de estrelas (1 a 5)
- **Formulário de avaliação**: Disponível para clientes com pedido entregue
- **Respostas da loja**: Exibidas junto com cada avaliação
- **Design responsivo**: Funciona em desktop, tablet e smartphone

### 🛡️ Painel Administrativo

- **Total de avaliações**: Contagem geral e aprovadas
- **Média de satisfação**: Média geral com estrelas
- **Lista completa**: Todas as avaliações (aprovadas e pendentes)
- **Aprovar/Ocultar**: Controle de quais avaliações são exibidas publicamente
- **Responder**: Responder a cada avaliação
- **Filtros avançados**: Filtrar por nota e status de aprovação

### 🗄️ Banco de Dados

**Tabelas:**
- `feedback_clientes`: Armazena as avaliações dos clientes
- `respostas_feedback`: Armazena as respostas da loja

**Funções RPC:**
- `criar_feedback()` - Cria uma nova avaliação
- `modificar_feedback_aprovacao()` - Aprova ou oculta uma avaliação
- `responder_feedback()` - Responde a uma avaliação
- `listar_feedbacks_aprovados()` - Lista avaliações públicas
- `listar_todos_feedbacks()` - Lista todas as avaliações (admin)
- `estatisticas_feedback()` - Retorna estatísticas gerais

### 🔒 Segurança

- **RLS (Row Level Security)**: Apenas clientes podem criar avaliações
- **Moderação**: Avaliações precisam ser aprovadas para serem exibidas
- **Autenticação**: Apenas staff pode aprovar/ocultar e responder avaliações
- **Validação**: Apenas pedidos entregues podem ser avaliados
- **Anti-spam**: Um pedido só pode ser avaliado uma vez

---

## 📁 Modelo de dados

Tabelas e funções utilizadas pelo código da aplicação (Supabase/Postgres):

| Tabela | Uso |
|---|---|
| `ingredientes` | `nome`, `unidade`, `quantidade`, `estoque_minimo`, `custo_unitario`, `validade` |
| `produtos` | `nome`, `categoria`, `preco`, `descricao`, `ativo` |
| `receitas` | Ficha técnica: `produto_id`, `ingrediente_id`, `quantidade` |
| `vendas` | `numero`, `tipo` (balcão/delivery/online), `status`, `cliente`, `telefone`, `endereco`, `motoboy_id`, `subtotal`, `desconto`, `taxa_entrega`, `total`, `custo`, `lucro`, `created_at` |
| `venda_itens` | Itens da venda: `produto_id`, `nome`, `quantidade` |
| `pedidos_online` | Pedidos da Loja Online: `cliente`, `telefone`, `endereco`, `itens`, `status`, `status_pagamento`, `expires_at`, `venda_id` |
| `pagamentos_online` | Auditoria de pagamentos: `pedido_id`, `transaction_id`, `status`, `metodo`, `valor` |
| `pedidos_online_audit` | Logs de auditoria: `pedido_id`, `acao`, `detalhes`, `usuario_id`, `created_at` |
| `feedback_clientes` | Avaliações dos clientes: `pedido_id`, `cliente_nome`, `nota`, `comentario`, `aprovado` |
| `respostas_feedback` | Respostas da loja: `feedback_id`, `resposta`, `respondido_por` |
| `motoboys` | `nome`, `telefone`, `ativo` |
| `cupons` | `codigo`, `percentual`, `ativo` |
| `loja_config` | Linha única (`id = 1`): `abre`, `fecha`, `taxa_entrega`, `som_alerta` |

**Funções RPC:**
- `registrar_venda(_itens, _tipo, _cliente?, _telefone?, _endereco?, _cupom?)` - Registra venda no PDV
- `confirmar_pagamento_online(_pedido_id)` - Confirma pagamento e vincula pedido online ao PDV
- `confirmar_pagamento_pedido(_token)` - Confirma pagamento e inicia delivery
- `expirar_pedido_online(_token)` - Cancela pedido expirado
- `verificar_expiracao_pedido(_token)` - Verifica se pedido expirou
- `listar_pedidos_com_timer()` - Lista pedidos aguardando pagamento com tempo restante
- `listar_pedidos_delivery()` - Lista pedidos com status de novo/expirado para delivery
- `limpar_pedidos_expirados()` - Limpa pedidos expirados automaticamente
- `registrar_audit_pedido(_pedido_id, _acao, _detalhes, _usuario_id)` - Registra ações no audit log
- `aceitar_pedido(_pedido_id)` - Aceita o pedido no delivery
- `recusar_pedido(_pedido_id, _motivo)` - Recusa o pedido com motivo
- `criar_feedback(_pedido_id, _cliente_nome, _nota, _comentario)` - Cria avaliação do cliente
- `modificar_feedback_aprovacao(_feedback_id, _aprovado)` - Aprova ou oculta avaliação
- `responder_feedback(_feedback_id, _resposta)` - Responde a uma avaliação
- `listar_feedbacks_aprovados()` - Lista avaliações públicas
- `listar_todos_feedbacks()` - Lista todas as avaliações (admin)
- `estatisticas_feedback()` - Retorna estatísticas gerais

**Status de pedido:** `novo` → `preparo` → `saiu` → `entregue` (ou `cancelado`).
**Status de pagamento:** `aguardando` → `pago` → `expirado`.

> As migrações SQL não fazem parte dos arquivos analisados. Mantenha-as versionadas no repositório (por exemplo em `supabase/migrations`) e documente aqui o processo de criação do schema.

## 🔒 Perfis e permissões

Existem três perfis: **administrador**, **gerente** e **atendente**. O hook `useRole` expõe `isManager`, usado para restringir ações sensíveis:

| Ação | Atendente | Gerente / Admin |
|---|:---:|:---:|
| Visualizar estoque e cardápio | ✅ | ✅ |
| Registrar entrada de estoque | ✅ | ✅ |
| Criar, editar e excluir ingredientes | ❌ | ✅ |
| Criar e editar produtos e fichas técnicas | ❌ | ✅ |

O **primeiro usuário cadastrado vira administrador**. Recomenda-se reforçar as permissões também com RLS (Row Level Security) no Supabase, pois a checagem na interface não substitui a do banco.

## 🤖 Previsão de demanda

O módulo `src/lib/forecast.ts` aplica **regressão linear** sobre a série diária dos últimos 30 dias para projetar, em um horizonte de 7 ou 14 dias:

1. número de pedidos;
2. faturamento;
3. consumo diário de cada ingrediente (vendas × ficha técnica).

A função `sugestaoCompra` combina o consumo previsto, o estoque atual e o estoque mínimo para sugerir a quantidade a comprar, e a lista é ordenada pelo valor estimado (custo unitário × quantidade).

## 🛠 Primeiros passos

### Pré-requisitos

- Node.js 20+ (recomendado 22 LTS)
- npm (ou outro gerenciador compatível)
- Um projeto Supabase com o schema descrito acima

### Instalação

```bash
git clone <url-do-repositorio>
cd <pasta-do-projeto>
npm install
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz com as credenciais do seu projeto Supabase. Use o arquivo `.env.example` como modelo:

```bash
cp .env.example .env
```

O `@lovable.dev/vite-tanstack-config` injeta automaticamente variáveis com prefixo `VITE_`. Os nomes costumam ser:

```env
SUPABASE_PROJECT_ID="lstycewiltrbefrxicdx"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_URL="https://lstycewiltrbefrxicdx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
VITE_SUPABASE_PROJECT_ID="lstycewiltrbefrxicdx"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
VITE_SUPABASE_URL="https://lstycewiltrbefrxicdx.supabase.co"
```

> ⚠️ **Importante**: O arquivo `.env` está no `.gitignore` e **NUNCA** deve ser commitado. Use `.env.example` como referência.

#### Obter a chave Service Role

A chave `SUPABASE_SERVICE_ROLE_KEY` é **obrigatória** para o funcionamento do sistema:

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard) → seu projeto → **Settings → API**
2. Na seção "Project API keys", encontre a chave **`service_role`** (não a `anon`)
3. Clique em "Show" para revelar e copie a chave completa
4. Cole no `.env` em `SUPABASE_SERVICE_ROLE_KEY`

Para PIX dinâmico via Enviare (opcional):

```env
ENVIARE_API_KEY=<chave-api-enviare>
ENVIARE_MERCHANT_ID=<id-estabelecimento>
ENVIARE_WEBHOOK_SECRET=<segredo-hmac>
ENVIARE_WEBHOOK_URL=<url-webhook-edge-function>
```

### Executando em desenvolvimento

```bash
npm run dev
```

Acesse a URL exibida no terminal. Crie a primeira conta em `/auth` (ela será a administradora).

## 📜 Scripts disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `vite dev` | Servidor de desenvolvimento |
| `build` | `vite build` | Build de produção |
| `build:dev` | `vite build --mode development` | Build em modo desenvolvimento |
| `preview` | `vite preview` | Pré-visualização do build |
| `lint` | `eslint .` | Análise estática |
| `format` | `prettier --write .` | Formatação do código |
| `test` | `vitest run` | Executa os testes uma vez |
| `test:watch` | `vitest` | Testes em modo watch |

## 📁 Estrutura de pastas

```
.
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx              # Landing page
│   │   ├── auth.tsx               # Login / cadastro
│   │   ├── loja.tsx               # Loja Online
│   │   ├── rastrear.tsx           # Rastreamento de pedidos
│   │   ├── pagamento/$vendaId.tsx # Página de pagamento PIX
│   │   └── _authenticated/        # Rotas protegidas
│   │       ├── route.tsx          # Guard de autenticação + AppShell
│   │       ├── dashboard.tsx
│   │       ├── pdv.tsx
│   │       ├── delivery.tsx
│   │       ├── estoque.tsx
│   │       ├── cardapio.tsx
│   │       ├── financeiro.tsx
│   │       ├── previsoes.tsx
│   │       ├── alertas.tsx
│   │       └── config.tsx
│   ├── components/
│   │   ├── ui/                    # Componentes base (shadcn/Radix)
│   │   ├── ui-kit.tsx             # PageHeader, Panel, Stat, RouteError
│   │   ├── AppShell.tsx           # Layout autenticado
│   │   ├── NFCEPrint.tsx          # Cupom térmico com QR Code PIX
│   │   └── PixPaymentModal.tsx    # Modal de pagamento com timer e copiar código
│   ├── hooks/useRole.ts
│   ├── integrations/
│   │   ├── supabase/client.ts
│   │   └── lovable/index.ts
│   ├── lib/
│   │   ├── data.ts                # Queries, tipos e helpers (brl, num, dayKey...)
│   │   ├── forecast.ts            # Previsão e sugestão de compra
│   │   ├── pix.ts                 # Geração de payload PIX EMV QR Code
│   │   ├── enviare.ts             # Integração com API Enviare
│   │   └── online-order.ts        # Funções de pedido online
│   ├── components/
│   │   ├── OnlineOrderNFCE.tsx    # Cupom fiscal para pedidos online
│   │   ├── OnlineOrders.tsx       # Gestão de pedidos online no PDV
│   │   ├── OrderTracker.tsx       # Componente de rastreamento
│   │   └── OrderStatusBadge.tsx   # Badge de status do pedido
│   ├── supabase/
│   │   ├── migrations/            # Migrações SQL do banco
│   │   └── functions/             # Edge Functions (webhooks)
│   ├── router.tsx
│   ├── routeTree.gen.ts           # Gerado automaticamente
│   ├── server.ts
│   └── styles.css
├── vite.config.ts
├── tsconfig.json
└── package.json
```

> A árvore acima combina o que foi analisado diretamente com os caminhos referenciados pelos imports. Ajuste conforme o repositório real.

## 🎨 Design system

Tema escuro quente, inspirado em forno a lenha, definido em `src/styles.css` com tokens **OKLCH** e Tailwind 4 (`@theme inline`):

- **Tipografia:** *Fraunces* (títulos, serifada) e *Manrope* (texto)
- **Cores semânticas:** `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning` e `ember`, mais paleta de gráficos (`chart-1…5`) e de sidebar
- **Utilitários customizados:** `bg-ember-gradient`, `bg-hearth` e `shadow-glow`
- **Raio base:** `0.75rem`

## 🚀 Build e deploy

### Build Local

```bash
npm run build
npm run preview
```

O build é feito pelo Nitro, e o alvo padrão definido pela configuração da Lovable é **Cloudflare**. Para outro provedor, ajuste o preset do Nitro em `vite.config.ts` via `defineConfig({ vite: { ... } })`. Lembre-se de configurar as variáveis de ambiente no provedor escolhido.

### Deploy na Vercel

O projeto está configurado para deploy na Vercel via `vercel.json`. Para fazer o deploy:

```bash
# Instalar CLI da Vercel (se necessário)
npm i -g vercel

# Fazer deploy
vercel
```

**Variáveis de ambiente obrigatórias na Vercel:**

Acesse o painel da Vercel → Settings → Environment Variables e adicione:

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do seu projeto Supabase (ex: `https://xyz.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Chave secreta** para operações de servidor (migrações, RPC) — começa com `sb_secret_` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública/anon do Supabase — começa com `sb_publishable_` |
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase (mesma que `SUPABASE_URL`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública (mesma que `SUPABASE_PUBLISHABLE_KEY`) |

> ⚠️ **SUPABASE_SERVICE_ROLE_KEY é essencial!** Sem ela, as migrações de banco de dados e funções RPC (criar pedido, confirmar pagamento, aceitar pedido) não funcionam. Obtenha em: Supabase Dashboard → Settings → API → API Keys → `service_role` secret.
>
> ⚠️ **NUNCA** exponha esta chave no frontend ou em repositórios públicos!

**Variáveis opcionais (PIX Dinâmico via Enviare):**

| Variável | Descrição |
|---|---|
| `ENVIARE_API_KEY` | Chave API da Enviare |
| `ENVIARE_MERCHANT_ID` | ID do estabelecimento |
| `ENVIARE_WEBHOOK_SECRET` | Segredo HMAC para webhook |
| `ENVIARE_WEBHOOK_URL` | URL da Edge Function do webhook |

**Após configurar as variáveis:**

1. Faça um novo deploy (Redeploy na Vercel ou push no Git)
2. Acesse `/check-env` para verificar o status do sistema
3. Se mostrar "⚠️ Configuração incompleta", acesse `/apply-migrations?auto=1` para criar as tabelas
4. Teste o fluxo: `/loja` → `/delivery` → `/rastrear`

**Configuração do `vercel.json`:**
- Framework: `tanstack-start`
- Build command: `npm run build`
- Output directory: `.output`
- Rewrites: Todas as rotas redirecionadas para `/` (SPA routing)
- **Headers de segurança**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security (HSTS)`, `Referrer-Policy`, `Permissions-Policy`

### 🔒 Segurança

O projeto segue as melhores práticas de segurança:

- **Chaves secretas protegidas**: `.env` no `.gitignore` — nunca commitado
- **Modelo de configuração**: `.env.example` com placeholders seguros
- **Headers HTTP de segurança**: HSTS, XSS Protection, Clickjacking Protection, Permissions Policy
- **Proteção de rotas de API**: Migrações desabilitadas em produção sem chave válida
- **RLS (Row Level Security)**: Políticas no Supabase para controle de acesso por usuário
- **Validação de tipos**: TypeScript estrito com `noUncheckedIndexedAccess`
- **Sanitização de entrada**: Validação em todas as rotas de API

#### Checklist de segurança antes do deploy

- [ ] `.env` não está no repositório
- [ ] `SUPABASE_SERVICE_ROLE_KEY` é uma chave real (não placeholder)
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] RLS habilitado no Supabase
- [ ] Headers de segurança ativos no `vercel.json`
- [ ] Testes passando (`npm test`)
- [ ] TypeScript sem erros (`npx tsc --noEmit`)

### Migrações SQL no Supabase

Após o deploy, **aplique as migrações SQL** no seu projeto Supabase:

```bash
# Método 1 (Recomendado)
supabase db push

# Método 2
# Supabase Dashboard → SQL Editor → Executar cada migração em ordem:
# supabase/migrations/0001_online_store.sql
# supabase/migrations/0002_online_payment.sql
# supabase/migrations/0005_delivery_integration.sql
# supabase/migrations/0006_feedback_and_order_flow.sql
# supabase/migrations/0007_fix_realtime_replication.sql  ← Obrigatório para Realtime
# supabase/migrations/0008_tracking_and_notifications.sql
```

> **Importante:** A migração `0007_fix_realtime_replication.sql` é obrigatória para o sistema de sincronização em tempo real funcionar corretamente. Ela configura `REPLICA IDENTITY FULL` nas tabelas monitoradas pelo Supabase Realtime.

## 📝 Convenções de código

- TypeScript estrito, incluindo `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` e `noImplicitReturns`.
- Alias de importação `@/*` → `src/*`.
- Dados sempre carregados no `loader` (`ensureQueryData`) e lidos no componente com `useSuspenseQuery`.
- Após mutações, invalide as `queryKey` correspondentes (`["vendas"]`, `["ingredientes"]`, etc.).
- Não edite `routeTree.gen.ts`.
- Antes de commitar: `npm run lint`, `npm run format` e `npm run test`.

## 🛣 Roadmap

### ✅ Concluído

- Estoque
- PDV
- Loja Online
- Pagamento PIX (QR Code EMV)
- PIX Dinâmico via Enviare (opcional)
- Confirmação automática de pagamento
- Timer de expiração de pagamento (5 min)
- Rastreamento de pedidos online
- Sincronização Loja Online → PDV
- Delivery Online
- Kanban Realtime
- Financeiro
- Dashboard BI
- Login Google
- Impressão 80mm
- Inteligência de Compras
- Taxas fiscais no cupom
- Aceite e recusa de pedidos com motivo
- Sistema de avaliações e feedbacks
- Painel admin de moderação de avaliações

### 🚧 Em Desenvolvimento

- WhatsApp Business
- Impressão automática sem diálogo
- Relatórios avançados
- Dashboard de pagamentos online

### 🔮 Futuras Versões

- Aplicativo Android
- Aplicativo iOS
- Multiunidades
- Franquias
- QR Code para mesas
- Integração iFood
- Integração Mercado Pago

---

## 👨‍💻 Equipe DEV.CODE

**Projeto desenvolvido durante o Programa Serratec**

### Desenvolvedores

- Paulo Roberto Silva de Oliveira Júnior
- João
- Gabriel
- João Daniel
- Douglas Lopes
- Samuel

### 🎓 Orientação

**Professor Rodrigo Braga**

### 🏫 Instituições


- UNIFESO

---

## 🤝 Agradecimentos

Agradecemos ao **Serratec**, ao **SEBRAE**, ao **UNIFESO** e ao **Professor Rodrigo Braga** pela oportunidade, apoio, orientação e incentivo ao desenvolvimento deste projeto.

O PizzaStockAI representa a união entre **tecnologia, inovação e empreendedorismo**, aplicando conhecimentos de Arquitetura de Software, Desenvolvimento Full Stack, Banco de Dados, UX/UI e Inteligência de Negócios para solucionar desafios reais do mercado.

---

## 📜 Licença

**Privado - Todos os direitos reservados**
