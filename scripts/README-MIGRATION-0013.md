# Como Aplicar a Migração 0013 - Fluxo Unificado de Pedidos

## 📋 Visão Geral

Esta migração unifica o fluxo de pedidos para **todos os módulos** (Loja Online, Balcão, Delivery) usando exatamente o mesmo processo operacional.

### Fluxo Unificado de 6 Etapas:

```
📥 Pedidos Recentes → ✅ Pedido Recebido → 👨‍🍳 Preparando → 📦 Pronto → 🚚 Saiu p/ Entrega → ✅ Entregue
```

### Status Unificados:

| Status | Descrição |
|--------|-----------|
| `pendente` | Pedido criado, aguardando ser aceito |
| `recebido` | Pedido aceito e entrou na fila de produção |
| `preparando` | Pedido está sendo preparado |
| `pronto` | Pedido está pronto para entrega/retirada |
| `em_entrega` | Pedido saiu para entrega |
| `finalizado` | Pedido entregue ou finalizado |
| `cancelado` | Pedido cancelado |

---

## 🚀 Opção 1: Aplicar via Script Interativo (Recomendado)

Execute o script PowerShell que oferece 3 opções de aplicação:

```powershell
.\scripts\apply-migration-0013.ps1
```

O script guiará você passo a passo através das opções disponíveis.

---

## 🔧 Opção 2: Aplicar via Supabase CLI

### Passo 1: Fazer Login

```powershell
supabase login
```

Isso abrirá o navegador para autenticação. Faça login com sua conta do Supabase.

### Passo 2: Linkar o Projeto (se necessário)

```powershell
supabase link --project-ref lstycewiltrbefrxicdx
```

### Passo 3: Aplicar Todas as Migrações Pendentes

```powershell
supabase db push
```

Ou aplicar apenas esta migração específica:

```powershell
supabase db shell -f supabase/migrations/0013_unified_order_flow.sql
```

---

## 📝 Opção 3: Aplicar via SQL Editor (Manual)

### Passo 1: Acessar o Painel do Supabase

1. Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione o projeto **PizzaStockAI** (lstycewiltrbefrxicdx)

### Passo 2: Abrir o SQL Editor

1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique no botão **New query** ou **Run SQL query**

### Passo 3: Copiar o Conteúdo da Migração

Abra o arquivo `supabase/migrations/0013_unified_order_flow.sql` e copie **todo o conteúdo** (294 linhas).

### Passo 4: Colar e Executar

1. Cole o conteúdo no editor SQL
2. Clique no botão **Run** (ou pressione `Ctrl+Enter`)
3. Aguarde a conclusão — você verá uma mensagem de sucesso

---

## 🔍 O Que a Migração Faz

### 1. Atualiza `registrar_venda`
- Todos os pedidos (delivery e balcão) agora entram com status `'pendente'`
- Seguem o mesmo fluxo operacional unificado

### 2. Migra Status Existentes
- Converte status antigos para o novo padrão:
  - `novo` → `pendente`
  - `preparo` → `preparando`
  - `saiu` → `em_entrega`
  - `entregue` → `finalizado`
  - `concluido` → `finalizado`

### 3. Atualiza `aceitar_pedido`
- Ao aceitar um pedido, vai direto para `'recebido'`
- Registra automaticamente a venda no financeiro
- Dá baixa automática no estoque

### 4. Adiciona Coluna `origem`
- Identifica a origem do pedido: `loja_online`, `pdv`, `delivery`
- Permite filtrar e organizar pedidos por origem

### 5. Atualiza Pedidos Online Existentes
- Converte todos os status de pedidos online para o novo padrão

### 6. Cria `avancar_status_pedido`
- Função unificada para avançar o status de qualquer tipo de pedido
- Valida as transições de status para garantir integridade

---

## ✅ Validações Após Execução

Após aplicar a migração, verifique:

### No Painel do Supabase

1. **SQL Editor** - Execute estas queries para verificar:

```sql
-- Verificar funções atualizadas
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('registrar_venda', 'aceitar_pedido', 'avancar_status_pedido');

-- Verificar coluna origem em pedidos_online
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'pedidos_online' AND column_name = 'origem';

-- Verificar status das vendas
SELECT status, COUNT(*) as total 
FROM vendas 
GROUP BY status 
ORDER BY status;

-- Verificar status dos pedidos online
SELECT status, COUNT(*) as total 
FROM pedidos_online 
GROUP BY status 
ORDER BY status;
```

2. **Table Editor** - Verifique as tabelas:
   - `vendas` - status atualizados
   - `pedidos_online` - status atualizados e coluna `origem` presente

3. **Logs** - Verifique se não há erros SQL nos logs do Supabase

### Na Aplicação

1. **Delivery** - Acesse `/delivery` e verifique:
   - 6 colunas visíveis: Pedidos Recentes, Pedido Recebido, Preparando, Pronto, Saiu p/ Entrega, Entregue
   - Pedidos aparecendo nas colunas corretas
   - Botões funcionando corretamente

2. **Loja Online** - Faça um teste de compra:
   - Pedido aparece automaticamente em "Pedidos Recentes"
   - Status atualiza em tempo real

3. **PDV** - Crie uma venda:
   - Pedido entra com status `'pendente'`
   - Aparece na fila de delivery

4. **Rastreamento** - Verifique `/rastrear/{pedidoId}`:
   - Timeline mostra as 6 etapas
   - Status atualiza em tempo real

---

## 🧪 Testes Obrigatórios

Após aplicar a migração, execute estes testes:

### Teste 1: Pedido Online
1. Acesse a Loja Online
2. Adicione itens ao carrinho
3. Finalize a compra
4. Verifique se o pedido aparece em "Pedidos Recentes" no delivery
5. Clique em "Receber Pedido" e verifique se vai para "Pedido Recebido"
6. Continue avançando os status até "Entregue"

### Teste 2: Pedido via PDV
1. Acesse o PDV
2. Crie uma venda de delivery
3. Verifique se o pedido aparece em "Pedidos Recentes"
4. Siga o mesmo fluxo do teste 1

### Teste 3: Pedido de Balcão
1. Acesse o PDV
2. Crie uma venda de balcão
3. Verifique se o pedido aparece na fila
4. Siga o fluxo até finalizado

### Teste 4: Múltiplos Pedidos Simultâneos
1. Crie 3 pedidos online simultâneos
2. Verifique se todos aparecem corretamente
3. Processe cada um independentemente
4. Confirme que não há conflitos

### Teste 5: Integração com Financeiro
1. Crie um pedido
2. Aceite o pedido
3. Verifique se a venda foi registrada no financeiro
4. Confirme que o faturamento foi atualizado

### Teste 6: Baixa de Estoque
1. Anote a quantidade de um ingrediente antes do pedido
2. Crie e aceite um pedido que usa esse ingrediente
3. Verifique se a quantidade foi reduzida corretamente

---

## ⚠️ Importante

- **Backup**: Antes de aplicar a migração, faça um backup do banco de dados no painel do Supabase
- **Horário**: Aplique a migração em um horário de baixo tráfego
- **Testes**: Após aplicar, execute todos os testes obrigatórios antes de considerar a migração concluída
- **Rollback**: Em caso de erro, o backup permite restaurar o estado anterior

---

## 📞 Suporte

Se encontrar problemas durante a aplicação da migração:

1. Verifique os logs do Supabase em **Settings > Database > Logs**
2. Verifique os logs do Vercel em **Deployments > [último deploy] > Runtime Logs**
3. Confirme que todas as funções foram criadas/atualizadas corretamente
4. Verifique as permissões RLS não foram afetadas

---

## 🎯 Resultado Esperado

Após a migração bem-sucedida:

✅ Fluxo unificado ativo em produção
✅ Pedidos Online, Balcão e Delivery usando a mesma lógica
✅ Delivery recebendo pedidos automaticamente
✅ Status sincronizados em tempo real
✅ Estoque atualizado corretamente
✅ Financeiro atualizado corretamente
✅ Sistema estável em produção
✅ Nenhuma funcionalidade existente afetada
