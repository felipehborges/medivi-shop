## Why

The public Medivi Shop is intended to demonstrate the storefront experience, not operate as a real commerce service. Requiring a hosted database and multiple infrastructure providers makes that portfolio deployment costly and fragile while the existing full-stack implementation still has value as the foundation for a future commercial product.

## What Changes

- Add a separate frontend-only demo application to the monorepo, leaving the existing full-stack application and backend packages intact.
- Serve catalog, category, product, promotional, and order example data from versioned static fixtures.
- Persist cart and wishlist interactions in the visitor's browser.
- Provide a simulated checkout, payment outcome, and order-confirmation journey that never sends payment or personal data to a server.
- Clearly label checkout and payment screens as demonstrations with no real purchase or charge.
- Provide a browser-local admin showcase whose changes affect only the current visitor and can be reset.
- Configure the demo application for an independent Vercel deployment with no database or provider credentials.
- Document how the preserved full-stack application can be resumed for a future commercial deployment.

## Capabilities

### New Capabilities

- `frontend-demo-storefront`: Static catalog, browser-persisted commerce interactions, simulated checkout, and local admin showcase.
- `frontend-demo-deployment`: Credential-free build and Vercel deployment of the demo independently from the preserved full-stack application.

### Modified Capabilities

None. There are no existing OpenSpec capability specifications; the current full-stack behavior remains available unchanged.

## Impact

- Adds a new workspace application and shared/static demo data without replacing `apps/web`.
- Reuses the existing design system and suitable presentation components while removing server-action and database coupling from the demo runtime.
- Adds local browser storage schemas for cart, wishlist, demo orders, and admin overrides.
- Changes the recommended portfolio deployment target from the full-stack app to the demo app.
- Avoids production dependencies on Postgres, Redis, Stripe, Resend, object storage, authentication secrets, and webhook endpoints.
