# 🚀 Guia de Deploy — PizzaStockAI

## Resumo do Projeto

- **GitHub**: `https://github.com/Paulo68129/project-guidebook.git`
- **Vercel**: `https://project-guidebook.vercel.app`
- **Supabase**: Projeto configurado no dashboard

---

## 1. GitHub ✅

O código é versionado no repositório `master`. Para atualizar:

```bash
git add .
git commit -m "descrição das mudanças"
git push origin master
```

**Status**: ✅ Push realizado com sucesso (commit `2277c50`)

---

## 2. Vercel

### Deploy Automático via GitHub

Se o projeto estiver vinculado ao repositório GitHub na Vercel, o deploy é **automático** a cada push na branch `master`.

### Configuração Necessária

#### Variáveis de Ambiente

No painel da Vercel → **Project Settings** → **Environment Variables**, configure:

| Variável | Valor | Ambiente |
|----------|-------|----------|
| `SUPABASE_PROJECT_ID` | Seu project ID do Supabase | Production, Preview, Development |
| `SUPABASE_PUBLISHABLE_KEY` | Sua anon/public key | Production, Preview, Development |
| `SUPABASE_URL` | `https://SEU_PROJECT.supabase.co` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Sua service role key (confidencial) | Production, Preview, Development |
| `VITE_SUPABASE_PROJECT_ID` | Seu project ID do Supabase | Production, Preview, Development |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sua anon/public key | Production, Preview, Development |
| `VITE_SUPABASE_URL` | `https://SEU_PROJECT.supabase.co` | Production, Preview, Development |

> ⚠️ **Nunca commitar `.env` com chaves reais!** Use apenas os valores acima no painel da Vercel.

> ⚠️ **Importante**: As variáveis com prefixo `VITE_` são expostas no cliente (browser). As sem prefixo são usadas apenas no servidor.

#### Build Settings

- **Framework Preset**: Vite (ou TanStack Start)
- **Build Command**: `npm install && npm run build`
- **Output Directory**: `.output/public`

### Deploy Manual via CLI

```bash
# Login na Vercel
vercel login

# Deploy para produção
vercel --prod
```

---

## 3. Supabase

### Aplicar Migrações

As migrações SQL estão em `supabase/migrations/`. Para aplicar:

#### Opção 1: Via API do Projeto (Recomendado)

Acesse a rota `/apply-migrations` no navegador:

```
https://project-guidebook.vercel.app/apply-migrations
```

Isso executa todas as migrações pendentes, incluindo:
- **0019_product_images.sql**: Sistema de imagens com bucket `produtos`

#### Opção 2: Via Supabase Dashboard

1. Acesse o [Supabase Dashboard](https://app.supabase.com) e selecione seu projeto
2. Vá em **SQL Editor**
3. Copie o conteúdo de cada migração pendente
4. Execute manualmente

#### Opção 3: Via Supabase CLI

```bash
# Instale a CLI
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref SEU_PROJECT_REF

# Push migrações
supabase db push
```

### Verificar Bucket de Imagens

1. Acesse o Supabase Dashboard → **Storage**
2. Verifique se o bucket `produtos` existe
3. Confirme que as políticas RLS estão ativas:
   - `produtos read public` — Leitura pública
   - `produtos insert authenticated` — Upload autenticado
   - `produtos update authenticated` — Edição autenticada
   - `produtos delete authenticated` — Exclusão autenticada

### Configurar Service Role Key

Se as migrações falharem por permissão, verifique se a `SUPABASE_SERVICE_ROLE_KEY` está configurada corretamente na Vercel. Consulte `CONFIGURAR_SERVICE_ROLE_KEY.md` para detalhes.

---

## 4. Checklist de Deploy

- [x] Código commitado no GitHub
- [x] Push para branch `master`
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Deploy automático disparado pela Vercel
- [ ] Migrações do Supabase aplicadas (`/apply-migrations`)
- [ ] Bucket `produtos` verificado no Supabase Storage
- [ ] Testar upload de imagem no painel admin
- [ ] Testar exibição de imagem na loja online

---

## 5. Troubleshooting

### Imagens não aparecem

1. Verifique se o bucket `produtos` existe no Supabase Storage
2. Confirme que as políticas RLS estão ativas
3. Acesse `/apply-migrations` para re-aplicar as configurações
4. Verifique o console do navegador para erros de CORS

### Deploy falha na Vercel

1. Verifique se todas as variáveis de ambiente estão configuradas
2. Confirme que o `vercel.json` está correto
3. Verifique os logs de build na Vercel

### Erros de TypeScript

Erros pré-existentes em `server.ts` e `upload-image.ts` não afetam o deploy. O build ignora erros de tipo por padrão.

---

## 6. Links Úteis

- **GitHub**: https://github.com/Paulo68129/project-guidebook
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com (selecione seu projeto)
- **Demo Online**: https://project-guidebook.vercel.app
- **Loja Online**: https://project-guidebook.vercel.app/loja
