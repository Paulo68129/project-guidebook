# 🍕 PizzaStockAI

**Gestão inteligente para pizzarias**: estoque, PDV, delivery, finanças e previsão de demanda em um único painel.

![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.168-ef4444)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-backend-3ecf8e?logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4-6e9f18?logo=vitest&logoColor=white)

> *"Forno aceso, números na mão."* Menos desperdício, nenhuma ruptura no pico e compras guiadas por previsão de demanda.

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Rotas da aplicação](#rotas-da-aplicação)
- [Modelo de dados](#modelo-de-dados)
- [Perfis e permissões](#perfis-e-permissões)
- [Previsão de demanda](#previsão-de-demanda)
- [Primeiros passos](#primeiros-passos)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Design system](#design-system)
- [Build e deploy](#build-e-deploy)
- [Convenções de código](#convenções-de-código)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Visão geral

O PizzaStockAI é uma aplicação web full-stack (SSR) que centraliza a operação de uma pizzaria:

- controla **ingredientes**, validade e estoque mínimo;
- calcula o **custo e a margem** de cada produto a partir da ficha técnica;
- registra vendas de **balcão e delivery** com baixa automática de insumos;
- acompanha pedidos em um **quadro kanban** de delivery;
- apresenta **indicadores financeiros** (faturamento, CMV, lucro, ticket médio);
- sugere **compras** com base em previsão de demanda calculada sobre o histórico de vendas.

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Central (Dashboard)** | Faturamento e lucro do dia, deliveries em aberto, alertas de estoque, gráfico de 14 dias e ranking dos 5 produtos mais vendidos (30 dias). |
| **PDV** | Montagem de pedido por toque, alternância Balcão/Delivery, cupom de desconto, taxa de entrega automática e finalização via função atômica no banco (`registrar_venda`). |
| **Delivery** | Quadro com colunas *Novos → Em preparo → Saiu para entrega → Entregues*, atribuição de motoboy e cancelamento. Exibe as últimas 48h. |
| **Estoque** | CRUD de ingredientes, busca, entrada de mercadoria, destaque de itens abaixo do mínimo e vencidos, e valor total em estoque. |
| **Cardápio** | Cadastro de produtos com categoria, preço, disponibilidade e **ficha técnica** (receita). Mostra custo e margem (alerta visual abaixo de 30%). |
| **Financeiro** | Períodos de 7, 30 e 90 dias, faturamento, custo, lucro, margem, ticket médio, descontos, gráfico faturamento × lucro e **exportação CSV**. |
| **Previsões** | Projeção de pedidos e faturamento para 7 ou 14 dias, gráfico real × previsto e lista de compras sugerida com valor estimado. |
| **Alertas** | Agrupa ingredientes vencidos, vencendo em até 3 dias, zerados e abaixo do mínimo. |
| **Configurações** | Horário de funcionamento, taxa de entrega, som de alerta para novos deliveries, gestão de motoboys e cupons. |
| **Autenticação** | E-mail/senha e login com Google. O primeiro usuário cadastrado se torna administrador. |

## Stack tecnológica

**Frontend / Full-stack**
- [TanStack Start](https://tanstack.com/start) (SSR) + [TanStack Router](https://tanstack.com/router) com rotas baseadas em arquivos
- [TanStack Query](https://tanstack.com/query) (`useSuspenseQuery` + `ensureQueryData` nos loaders)
- React 19, TypeScript 5.8 (modo `strict` com flags adicionais)
- Tailwind CSS 4 + `tw-animate-css`
- Componentes baseados em [Radix UI](https://www.radix-ui.com/) (padrão shadcn/ui), `lucide-react`, `sonner`, `cmdk`, `vaul`
- Gráficos com [Recharts](https://recharts.org/)
- Formulários: `react-hook-form` + `zod`

**Backend / Infra**
- [Supabase](https://supabase.com/) (Auth, Postgres, RPC) via `@supabase/supabase-js`
- `@lovable.dev/cloud-auth-js` para OAuth (Google)
- Nitro como servidor (alvo padrão: Cloudflare no build)

**Qualidade**
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

## Rotas da aplicação

| Caminho | Acesso | Descrição |
|---|---|---|
| `/` | Público | Landing page |
| `/auth` | Público | Login, cadastro e Google OAuth |
| `/dashboard` | Autenticado | Central |
| `/pdv` | Autenticado | Ponto de venda |
| `/delivery` | Autenticado | Quadro de pedidos |
| `/estoque` | Autenticado | Ingredientes |
| `/cardapio` | Autenticado | Produtos e fichas técnicas |
| `/financeiro` | Autenticado | Resultados financeiros |
| `/previsoes` | Autenticado | Previsão e compras |
| `/alertas` | Autenticado | Alertas de estoque |
| `/config` | Autenticado | Configurações da loja |

## Modelo de dados

Tabelas e funções utilizadas pelo código da aplicação (Supabase/Postgres):

| Tabela | Uso |
|---|---|
| `ingredientes` | `nome`, `unidade`, `quantidade`, `estoque_minimo`, `custo_unitario`, `validade` |
| `produtos` | `nome`, `categoria`, `preco`, `descricao`, `ativo` |
| `receitas` | Ficha técnica: `produto_id`, `ingrediente_id`, `quantidade` |
| `vendas` | `numero`, `tipo` (balcão/delivery), `status`, `cliente`, `telefone`, `endereco`, `motoboy_id`, `subtotal`, `desconto`, `taxa_entrega`, `total`, `custo`, `lucro`, `created_at` |
| `venda_itens` | Itens da venda: `produto_id`, `nome`, `quantidade` |
| `motoboys` | `nome`, `telefone`, `ativo` |
| `cupons` | `codigo`, `percentual`, `ativo` |
| `loja_config` | Linha única (`id = 1`): `abre`, `fecha`, `taxa_entrega`, `som_alerta` |

**Função RPC:** `registrar_venda(_itens, _tipo, _cliente?, _telefone?, _endereco?, _cupom?)`

**Status de pedido:** `novo` → `preparo` → `saiu` → `entregue` (ou `cancelado`).

> As migrações SQL não fazem parte dos arquivos analisados. Mantenha-as versionadas no repositório (por exemplo em `supabase/migrations`) e documente aqui o processo de criação do schema.

## Perfis e permissões

Existem três perfis: **administrador**, **gerente** e **atendente**. O hook `useRole` expõe `isManager`, usado para restringir ações sensíveis:

| Ação | Atendente | Gerente / Admin |
|---|:---:|:---:|
| Visualizar estoque e cardápio | ✅ | ✅ |
| Registrar entrada de estoque | ✅ | ✅ |
| Criar, editar e excluir ingredientes | ❌ | ✅ |
| Criar e editar produtos e fichas técnicas | ❌ | ✅ |

O **primeiro usuário cadastrado vira administrador**. Recomenda-se reforçar as permissões também com RLS (Row Level Security) no Supabase, pois a checagem na interface não substitui a do banco.

## Previsão de demanda

O módulo `src/lib/forecast.ts` aplica **regressão linear** sobre a série diária dos últimos 30 dias para projetar, em um horizonte de 7 ou 14 dias:

1. número de pedidos;
2. faturamento;
3. consumo diário de cada ingrediente (vendas × ficha técnica).

A função `sugestaoCompra` combina o consumo previsto, o estoque atual e o estoque mínimo para sugerir a quantidade a comprar, e a lista é ordenada pelo valor estimado (custo unitário × quantidade).

## Primeiros passos

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

Crie um arquivo `.env` na raiz com as credenciais do seu projeto Supabase. O `@lovable.dev/vite-tanstack-config` injeta automaticamente variáveis com prefixo `VITE_`. Os nomes costumam ser:

```env
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave-publica>
```

> Confirme os nomes exatos em `src/integrations/supabase/client.ts`. Nunca versione chaves secretas.

### Executando em desenvolvimento

```bash
npm run dev
```

Acesse a URL exibida no terminal. Crie a primeira conta em `/auth` (ela será a administradora).

## Scripts disponíveis

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

## Estrutura de pastas

```
.
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx              # Landing page
│   │   ├── auth.tsx               # Login / cadastro
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
│   │   └── AppShell.tsx           # Layout autenticado
│   ├── hooks/useRole.ts
│   ├── integrations/
│   │   ├── supabase/client.ts
│   │   └── lovable/index.ts
│   ├── lib/
│   │   ├── data.ts                # Queries, tipos e helpers (brl, num, dayKey...)
│   │   └── forecast.ts            # Previsão e sugestão de compra
│   ├── router.tsx
│   ├── routeTree.gen.ts           # Gerado automaticamente
│   ├── server.ts
│   └── styles.css
├── vite.config.ts
├── tsconfig.json
└── package.json
```

> A árvore acima combina o que foi analisado diretamente com os caminhos referenciados pelos imports. Ajuste conforme o repositório real.

## Design system

Tema escuro quente, inspirado em forno a lenha, definido em `src/styles.css` com tokens **OKLCH** e Tailwind 4 (`@theme inline`):

- **Tipografia:** *Fraunces* (títulos, serifada) e *Manrope* (texto)
- **Cores semânticas:** `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning` e `ember`, mais paleta de gráficos (`chart-1…5`) e de sidebar
- **Utilitários customizados:** `bg-ember-gradient`, `bg-hearth` e `shadow-glow`
- **Raio base:** `0.75rem`

## Build e deploy

```bash
npm run build
npm run preview
```

O build é feito pelo Nitro, e o alvo padrão definido pela configuração da Lovable é **Cloudflare**. Para outro provedor, ajuste o preset do Nitro em `vite.config.ts` via `defineConfig({ vite: { ... } })`. Lembre-se de configurar as variáveis de ambiente no provedor escolhido.

## Convenções de código

- TypeScript estrito, incluindo `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` e `noImplicitReturns`.
- Alias de importação `@/*` → `src/*`.
- Dados sempre carregados no `loader` (`ensureQueryData`) e lidos no componente com `useSuspenseQuery`.
- Após mutações, invalide as `queryKey` correspondentes (`["vendas"]`, `["ingredientes"]`, etc.).
- Não edite `routeTree.gen.ts`.
- Antes de commitar: `npm run lint`, `npm run format` e `npm run test`.

## Contribuindo

1. Faça um fork do projeto.
2. Crie uma branch: `git checkout -b feat/minha-feature`.
3. Faça commits claros e objetivos.
4. Garanta que lint e testes passam.
5. Abra um Pull Request descrevendo a mudança.

## Licença

Projeto privado (`"private": true`). Defina aqui a licença desejada antes de abrir o código ao público.


