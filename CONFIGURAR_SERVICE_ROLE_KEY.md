# 🔑 Configuração da Service Role Key do Supabase

## Problema Atual

O sistema está usando a **Publishable Key** do Lovable Cloud como fallback para a Service Role Key. Isso permite **ler** dados do banco, mas **bloqueia** todas as operações de escrita (salvar, editar, excluir) devido ao RLS (Row Level Security).

### Status das credenciais testadas

| Credencial | Status | Detalhes |
|------------|--------|----------|
| `yjryifsvqnpwqvljbxoc.supabase.co` | ❌ Inválida | HTTP 401 "Invalid API key" |
| Service Role Key JWT | ❌ Rejeitada | Chave não é reconhecida pelo Supabase |
| Lovable Cloud (fallback) | ✅ Funcional | Apenas leitura, escrita via localStorage |

---

## Por que a chave foi rejeitada?

A chave Service Role fornecida (`eyJhbGciOiJIUzI1NiIs...`) foi testada diretamente com o servidor do Supabase e retornou:

```json
{"message":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}
```

### Possíveis causas:

1. **Projeto deletado** — o projeto `yjryifsvqnpwqvljbxoc` pode ter sido removido
2. **Chave revogada** — a chave pode ter sido regenerada no dashboard, invalidando a antiga
3. **Projeto suspenso** — projetos em plano gratuito podem ser suspensos
4. **Chave errada** — pode ser a chave `anon` em vez da `service_role`

---

## Solução: Obter uma Service Role Key válida

### Passo 1: Verificar o projeto

1. Acesse **https://supabase.com/dashboard**
2. Verifique se o projeto aparece na lista
3. Se **não aparecer**, o projeto foi deletado — crie um novo
4. Se **aparecer**, verifique se está ativo (não suspenso)

### Passo 2: Regenerar a chave

1. No dashboard, selecione o projeto
2. Vá em **Settings** ⚙️ → **API**
3. Na seção **"Project API keys"**, encontre a linha **`service_role`**
4. Clique em **"Regenerate"** e confirme com **"Yes, regenerate"**
5. Copie a **nova** chave (começa com `eyJ`, ~200-400 caracteres)

### Passo 3: Atualizar o `.env`

Edite o arquivo `.env` na raiz do projeto:

```env
SUPABASE_PROJECT_ID="yjryifsvqnpwqvljbxoc"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_SEU_NOVO_VALOR"
SUPABASE_URL="https://yjryifsvqnpwqvljbxoc.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIs..."
VITE_SUPABASE_PROJECT_ID="yjryifsvqnpwqvljbxoc"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_SEU_NOVO_VALOR"
VITE_SUPABASE_URL="https://yjryifsvqnpwqvljbxoc.supabase.co"
```

### Passo 4: Criar as tabelas

Se o projeto for novo, execute o SQL de `supabase/migrations/0014_master_setup.sql` no **SQL Editor** do Supabase para criar todas as 14 tabelas.

### Passo 5: Reiniciar o servidor

```powershell
# Pare o servidor (Ctrl+C) e reinicie
npm run dev
```

---

## Sistema atual com localStorage

Enquanto a Service Role Key não é configurada, o sistema funciona com **localStorage** como fallback:

| Funcionalidade | Status |
|----------------|--------|
| Visualizar cardápio | ✅ Supabase |
| Salvar produto | ✅ LocalStorage |
| Editar produto | ✅ LocalStorage |
| Excluir produto | ✅ LocalStorage |
| Visualizar estoque | ✅ Supabase |
| Salvar ingrediente | ✅ LocalStorage |
| Delivery pipeline | ✅ LocalStorage |
| Configurações | ✅ LocalStorage |
| Sincronização entre abas | ✅ Ativa |

### Vantagens do localStorage:
- Dados persistem no navegador
- Sincronização em tempo real entre abas
- Funciona sem conexão com banco

### Limitações:
- Dados ficam apenas no navegador local
- Não são compartilhados entre dispositivos
- Se limpar o cache, os dados são perdidos

---

## Após configurar a Service Role Key

Quando uma chave válida for configurada:
1. O sistema detectará automaticamente que o banco está acessível
2. Os dados do localStorage serão sincronizados com o Supabase
3. Todas as operações de escrita funcionarão diretamente no banco
4. Os dados serão acessíveis de qualquer dispositivo

---

## ⚠️ Segurança

- A Service Role Key é **secreta** — nunca a coloque no código do navegador
- O arquivo `.env` já está no `.gitignore`
- Use a chave apenas no servidor (backend)
