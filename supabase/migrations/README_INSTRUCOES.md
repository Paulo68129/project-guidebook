# 📋 Instruções: Criar as 6 Tabelas Faltantes no Supabase

## Status Atual

| Tabela | Status |
|--------|--------|
| produtos | ✅ Existe |
| ingredientes | ✅ Existe |
| receitas | ✅ Existe |
| vendas | ✅ Existe |
| venda_itens | ✅ Existe |
| cupons | ✅ Existe |
| loja_config | ✅ Existe |
| pedidos_online | ✅ Existe |
| **pagamentos_online** | ❌ **Faltando** |
| **pedidos_online_audit** | ❌ **Faltando** |
| **rastreamento_pedidos** | ❌ **Faltando** |
| **notificacoes_delivery** | ❌ **Faltando** |
| **feedback_clientes** | ❌ **Faltando** |
| **respostas_feedback** | ❌ **Faltando** |

---

## Opção 1: Script Completo (Recomendado) ⭐

Este script cria **TODAS as 14 tabelas** de uma vez, incluindo funções, triggers, RLS e grants. É idempotente — pode ser executado várias vezes sem erros.

**Arquivo:** `supabase/migrations/0014_master_setup.sql`

### Passo a Passo:

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor** 📝
4. Clique em **New Query** (Novo Script)
5. Abra o arquivo `supabase/migrations/0014_master_setup.sql` no seu editor
6. **Copie todo o conteúdo** do arquivo
7. **Cole** na janela do SQL Editor do Supabase
8. Clique em **Run** ▶️
9. Aguarde a mensagem **"Success. No rows returned"**

---

## Opção 2: Apenas as 6 Tabelas Faltantes

Se você prefere criar apenas as tabelas que estão faltando, use este script mais leve.

**Arquivo:** `supabase/migrations/06_tabelas_faltantes.sql`

### Passo a Passo:

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor** 📝
4. Clique em **New Query** (Novo Script)
5. Abra o arquivo `supabase/migrations/06_tabelas_faltantes.sql` no seu editor
6. **Copie todo o conteúdo** do arquivo
7. **Cole** na janela do SQL Editor do Supabase
8. Clique em **Run** ▶️
9. Aguarde a mensagem **"Success. No rows returned"**

---

## Verificação Após Executar

Depois de executar o SQL, verifique se as tabelas foram criadas:

### No Supabase Dashboard:
1. No menu lateral, clique em **Table Editor** 📊
2. Verifique se as 6 tabelas agora aparecem na lista:
   - pagamentos_online
   - pedidos_online_audit
   - rastreamento_pedidos
   - notificacoes_delivery
   - feedback_clientes
   - respostas_feedback

### Via SQL Editor:
Cole esta query no SQL Editor e clique em Run:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Deve retornar **14 tabelas**.

---

## O que cada tabela faz:

| Tabela | Finalidade |
|--------|------------|
| `pagamentos_online` | Registra os pagamentos PIX de pedidos online |
| `pedidos_online_audit` | Log de auditoria de todas as ações nos pedidos |
| `rastreamento_pedidos` | Histórico de status de cada pedido (para a página `/rastrear`) |
| `notificacoes_delivery` | Notificações de novos pedidos e pagamentos |
| `feedback_clientes` | Avaliações e comentários dos clientes (para `/avaliacoes`) |
| `respostas_feedback` | Respostas da loja aos feedbacks dos clientes |

---

## Após Criar as Tabelas

1. **Reinicie o servidor de desenvolvimento** (Ctrl+C e depois `npm run dev`)
2. Acesse `http://localhost:8081/api/check-env` para verificar
3. O resultado deve mostrar **14/14 tabelas** e `"ready": true`

---

## Problemas Comuns

### "Success. No rows returned"
✅ Isso é sucesso! Significa que o SQL foi executado corretamente.

### Erro de permissão
Se aparecer erro de permissão, certifique-se de estar logado no Supabase com a conta correta.

### Tabelas não aparecem no Table Editor
Espere alguns segundos e atualize a página. O cache do Supabase pode demorar um pouco para atualizar.

### "relation already exists"
Se aparecer este erro, significa que a tabela já existe. O script usa `CREATE TABLE IF NOT EXISTS`, então normalmente não ocorre. Se acontecer, verifique se você executou o script anterior parcialmente.

---

## Scripts Disponíveis

| Arquivo | Descrição |
|---------|-----------|
| `0014_master_setup.sql` | **Script completo** — todas as 14 tabelas + funções + RLS + grants |
| `06_tabelas_faltantes.sql` | **Apenas as 6 faltantes** — mais leve, só o necessário |
| `0006_feedback_and_order_flow.sql` | Apenas feedback e fluxo de pedidos |
| `0008_tracking_and_notifications.sql` | Apenas rastreamento e notificações |
| `0002_online_payment.sql` | Apenas pagamentos online |

**Recomendação:** Use o `0014_master_setup.sql` para garantir que tudo está configurado corretamente.
