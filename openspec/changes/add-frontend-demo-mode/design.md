## Context

The repository currently contains a production-oriented Next.js storefront in `apps/web` backed by Postgres, Better Auth, payment, email, storage, rate-limit, and monitoring packages. The public deployment is instead a portfolio experience: visitors must be able to explore realistic commerce flows without creating infrastructure, transmitting personal/payment data, or changing shared state. The full-stack implementation must remain usable as a future commercial product.

## Goals / Non-Goals

**Goals:**

- Publish a polished storefront demo with no runtime backend or secrets.
- Preserve the current full-stack app and backend packages in working form.
- Persist interactive state per browser and make demo state easy to reset.
- Reuse the established visual identity, assets, and UI primitives.
- Make the demonstration status unmistakable during checkout and payment.

**Non-Goals:**

- Real accounts, cross-device state, payments, fulfillment, email, analytics ingestion, or shared admin mutations.
- Replacing or deleting the commercial full-stack implementation.
- Maintaining feature parity with every backend-only operational workflow in the first demo release.

## Decisions

### Add an independent `apps/demo` application

The demo will be a separate Next.js workspace application. This is preferred over scattering demo-mode branches throughout `apps/web`, because a compile-time flag would still leave accidental database imports and server-action coupling easy to reintroduce. It also avoids converting the preserved commercial code into commented or dead code.

Alternative considered: replace `apps/web` with browser adapters. Rejected because it makes resuming the commercial version harder and mixes two incompatible runtime models.

### Use versioned fixtures plus browser storage

Canonical catalog, category, banner, and sample-order data will live in TypeScript fixtures. Cart, wishlist, checkout draft, demo orders, and optional admin overrides will use a versioned `localStorage` envelope. Invalid or outdated browser state will fall back safely to fixtures.

Alternative considered: a free hosted database. Rejected because shared mutable state, credentials, migrations, and service availability provide no value to the portfolio scenario.

### Keep the public journey realistic but explicitly simulated

The demo will preserve browse, search/filter, product detail, cart, checkout, payment result, and confirmation screens. Checkout data remains in the browser. The payment screen will use explicit approve/decline simulation and will not ask for a real card number.

### Reuse UI selectively, not server-coupled components wholesale

The demo may import primitives from `packages/ui` and copy/adapt presentation patterns and assets from `apps/web`. Components that import database types, server actions, auth, or cookies will not be shared until their presentation boundary is clean enough to do so without coupling.

### Deploy the demo as the portfolio Vercel project

Vercel will build `apps/demo` independently. The app must build with no environment variables and expose no API routes. The existing `apps/web` remains deployable separately for future commercial use.

## Risks / Trade-offs

- [Browser storage can be cleared or become incompatible] → Version the stored envelope, validate at read time, and provide a visible reset control.
- [Visitors may mistake the checkout for a live store] → Show persistent demo messaging and a prominent no-charge notice at checkout/payment.
- [Duplicated presentation code can drift] → Share only stable primitives now and document candidates for later extraction.
- [Static data reduces operational realism] → Use realistic fixtures and interaction states while explicitly accepting that state is local to one browser.
- [Building the monorepo root could still build `apps/web`] → Give the Vercel demo project an explicit root/build configuration targeting only `apps/demo`.

## Migration Plan

1. Scaffold `apps/demo` and its static data/browser-state foundation.
2. Implement and validate the public storefront journey.
3. Add the local admin showcase and reset behavior.
4. Add deployment documentation and a Vercel-specific build path.
5. Deploy a preview, run smoke/E2E checks, then promote it as the portfolio URL.

Rollback is limited to promoting the previous Vercel deployment. The existing full-stack application is never removed or migrated.

## Open Questions

- The final custom domain can be attached after the generated Vercel URL is validated.
- The demo admin showcase can grow beyond its initial catalog-management surface in later iterations without changing this architecture.
