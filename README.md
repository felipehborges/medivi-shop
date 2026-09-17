# Medivi Shop

Loja de fantasia criada como projeto de portfólio. A [demo pública](https://medivi-shop.vercel.app) permite explorar o catálogo, salvar favoritos, montar um carrinho, simular um checkout e testar um painel administrativo. Os dados da demo ficam no navegador; não há cobrança, conta ou envio de pedidos.

![Página inicial da demo Medivi Shop](docs/images/demo-desktop.webp)

## O que explorar

- Catálogo com busca, filtros, ordenação, variantes e páginas de produto.
- Carrinho e favoritos persistidos localmente, com fluxo de pagamento aprovado ou recusado de forma simulada.
- Painel administrativo de demonstração para alterar a visibilidade dos produtos e conferir pedidos simulados.
- Interface responsiva, temas claro e escuro e alternância entre português e inglês.

## Estrutura do projeto

| Diretório | Papel |
| --- | --- |
| `apps/demo` | Experiência pública de portfólio. Export estático do Next.js, sem banco de dados ou credenciais. |
| `apps/web` | Implementação comercial completa, com autenticação, persistência, pagamentos e operações administrativas. |
| `packages/*` | Componentes e serviços compartilhados da implementação comercial. |

A demo foi separada da implementação comercial para que qualquer pessoa possa testá-la sem criar contas ou acionar provedores externos. O [guia da demo](docs/demo-runbook.md) explica a publicação; o [runbook da loja completa](docs/runbook.md) cobre os serviços necessários para `apps/web`.

## Rodar localmente

Requer Node.js 24 e pnpm 11.14.0. A demo não precisa de `.env`, Docker ou banco de dados.

```bash
pnpm install --frozen-lockfile
pnpm dev:demo
```

Abra `http://localhost:3000`. Para verificar a demo:

```bash
pnpm --filter @medivi/demo lint
pnpm --filter @medivi/demo typecheck
pnpm --filter @medivi/demo test
pnpm --filter @medivi/demo test:e2e
pnpm build:demo
```

## Tecnologias

Next.js, React, TypeScript, Tailwind CSS, pnpm workspaces, Turborepo, Vitest e Playwright. A implementação comercial também usa PostgreSQL, Drizzle ORM e Better Auth, com provedores configuráveis para pagamento, e-mail e armazenamento.

## Licença

[MIT](LICENSE).
