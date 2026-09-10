## 1. Demo Application Foundation

- [x] 1.1 Scaffold the independent `apps/demo` Next.js workspace with shared UI styling and a credential-free production build
- [x] 1.2 Add versioned categories, products, banners, variants, and sample operational data using the existing Medivi assets
- [x] 1.3 Implement a validated, versioned browser-state provider for cart, wishlist, demo orders, and admin overrides

## 2. Storefront Experience

- [x] 2.1 Build the responsive landing page, navigation, promotional sections, and demo disclosure
- [x] 2.2 Build catalog browsing with category, search, filtering, sorting, and empty states
- [x] 2.3 Build product detail with gallery, variant selection, stock feedback, wishlist, related products, and add-to-cart behavior
- [x] 2.4 Build persistent cart drawer/page with quantity constraints, removal, subtotal, and reset behavior

## 3. Simulated Purchase Journey

- [x] 3.1 Build a browser-only checkout form and order summary with a prominent privacy/no-charge disclosure
- [x] 3.2 Build simulated approve/decline payment states without collecting card data
- [x] 3.3 Build browser-local order confirmation/history behavior and verify cart clearing only on approval

## 4. Local Admin Showcase

- [x] 4.1 Build a clearly labeled demo admin dashboard using bundled operational metrics
- [x] 4.2 Add supported browser-local catalog mutations and a restore-defaults control

## 5. Verification and Deployment

- [x] 5.1 Add focused tests for fixture queries, browser-state migration/validation, cart limits, and payment outcomes
- [x] 5.2 Add an end-to-end smoke test for browse-to-confirmation and verify the demo performs no application data requests
- [x] 5.3 Document the independent demo/full-stack workflows and configure the demo for Vercel deployment
- [x] 5.4 Run lint, typecheck, tests, and production build for the demo
- [x] 5.5 Deploy the demo to the user's existing Vercel account and validate the public URL
