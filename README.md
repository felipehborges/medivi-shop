# Medivi Shop

Loja de fantasia criada como projeto de portfólio. A [demo pública](https://medivi-shop.vercel.app) permite explorar o catálogo, salvar favoritos, montar um carrinho, simular um checkout e testar um painel administrativo. Os dados da demo ficam no navegador; não há cobrança, conta ou envio de pedidos.

![Página inicial da demo Medivi Shop](docs/images/demo-desktop.webp)

## O que explorar

- Catálogo com busca, filtros, ordenação, variantes e páginas de produto com galeria e zoom. As fotos da galeria se repetem nesta demo até haver imagens de outros ângulos.
- Carrinho e favoritos persistidos localmente, com fluxo de pagamento aprovado ou recusado de forma simulada.
- Painel administrativo de demonstração para alterar a visibilidade dos produtos e conferir pedidos simulados.
- Interface responsiva, temas claro e escuro e alternância entre português e inglês.

## Estrutura do projeto

| Diretório | Papel |
| --- | --- |
| `apps/demo` | Experiência pública de portfólio. Export estático do Next.js, sem banco de dados ou credenciais. |
| `apps/web` | Código comercial guardado para uma possível loja real. Não participa dos comandos padrão nem do CI. |
| `packages/ui` | Componentes compartilhados usados pela demo. |
| `packages/db`, `packages/payments`, `packages/email`, `packages/storage`, `packages/ratelimit` | Serviços comerciais guardados, sem execução no front. |

A aplicação ativa é `apps/demo`: páginas estáticas, catálogo local e carrinho, favoritos, pedidos simulados e painel de demonstração salvos no navegador. Não há API da aplicação, autenticação real, pagamento real ou banco de dados. O [guia da demo](docs/demo-runbook.md) explica a publicação. O [runbook comercial](docs/runbook.md) fica como referência para o futuro.

## Rodar localmente

Requer Node.js 24 e pnpm 11.14.0. A demo não precisa de `.env`, Docker ou banco de dados.

```bash
pnpm install --filter @medivi/demo... --frozen-lockfile
pnpm dev
```

Abra `http://localhost:3000`. `pnpm dev`, `build`, `lint`, `typecheck`, `test` e `test:e2e` trabalham apenas com o front e seus componentes compartilhados. Nenhum deles inicia Docker, migrações ou serviços comerciais.

Para verificar a demo:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Se um dia a base comercial for retomada, instale todas as dependências e consulte o [runbook comercial](docs/runbook.md). Os comandos explícitos `dev:web`, `legacy:build`, `legacy:db:migrate` e `legacy:db:seed` continuam disponíveis para esse cenário.

## Tecnologias

Next.js, React, TypeScript, Tailwind CSS, pnpm workspaces, Turborepo, Vitest e Playwright. A implementação comercial também usa PostgreSQL, Drizzle ORM e Better Auth, com provedores configuráveis para pagamento, e-mail e armazenamento.

## Licença

[MIT](LICENSE).
