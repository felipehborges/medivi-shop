# 02 — Frontend

Findings: `FE-01` … `FE-12`, `IMG-01`, `SEO-01`, `A11Y-01`.

---

## 1. How the frontend actually works

**State model.** There is no client data-fetching layer and no client store.
Server state (cart, products, orders) lives in Postgres, reaches the UI via
Server Components, and is refreshed by `revalidatePath` inside Server Actions
followed by an implicit router refresh. Client state is limited to `useState`
in ~20 Client Components (drawer open, selected variant, form state, gallery
index, carousel index). `plan.md` §24 says Zustand is used for this — it isn't
installed (ARCH-03); the actual approach is simpler and fine.

**Client Component inventory** (39 files with `"use client"` under `apps/web`): forms
(checkout, sign-in, sign-up, forgot/reset password, address, product, banner,
category, order-lookup, newsletter), interactive widgets (cart drawer via
`CartLineItem`, variant panel, gallery, hero carousel, search bar, wishlist
button, admin managers, order/user/product action buttons), beacons
(`AnalyticsBeacon`, `CheckoutCompletedBeacon`, `OrderStatusPoller`), and the
four `error.tsx` boundaries. The discipline is good — none of these would work
as Server Components.

**Rendering.** Everything is dynamic (ARCH-01). `loading.tsx` exists at the
root and per route group, plus a bespoke skeleton for `/product/[slug]`.
`error.tsx` exists at the root, per route group, and `global-error.tsx`.
`not-found.tsx` at the root.

---

## FE-01 `checkoutAction` is called with no error handling — a thrown error is silently swallowed

**Confidence: Confirmed**

### Localização

`apps/web/components/checkout-form.tsx:43-61` (specifically line 45)

### Problema

```ts
async function onSubmit(values: CheckoutInput) {
  setServerError(null);
  const result = await checkoutAction(values);   // ← no try/catch
  if (result.reason === "empty_cart") { … }
  …
}
```

`checkoutAction` returns a typed result for four expected failures, and
`redirect()`s on success. But it can also **throw**, on at least five paths:

| Throw source | File:line |
|---|---|
| `checkoutSchema.parse(input)` — ZodError | `lib/actions/checkout.ts:34` |
| `getPaymentProvider()` — missing Stripe keys | `lib/payments.ts:13` |
| `provider.createCheckoutSession()` — Stripe API down / rate-limited / 4xx | `packages/payments/src/providers/stripe.ts:27` |
| `"Stripe did not return a checkout URL"` | `packages/payments/src/providers/stripe.ts:46` |
| `createPayment()` — any DB error | `lib/actions/checkout.ts:70` |

When any of these throws, the rejection propagates out of `onSubmit` into
React Hook Form's `handleSubmit`, which re-throws it. The result in a
production build: no `serverError` is set, `isSubmitting` flips back to
`false`, and **the user sees the button return to "Pay $X" with no message at
all**. They will click again. And in the last case (`createPayment` throwing),
a `pending` order already exists in the database with no payment row —
clicking again creates a second one.

There is no `error.tsx` rescue here either: the throw happens in a client
event handler after hydration, not during render, so no error boundary
catches it.

### Por que isso é um problema

This is the highest-stakes form in the application. A silent failure at the
"Pay" button is both the worst possible UX moment and the exact scenario that
produces orphaned `pending` orders and duplicate submissions (ECM-07).

`plan.md` §20 states the intended contract: *"Zod validation at every
boundary; validation failures are typed, expected results (not thrown
exceptions) so forms can render field-level errors."* The action does that for
four cases and violates it for five.

### Cenário que reproduz o problema

1. Deploy with `PAYMENT_PROVIDER=stripe`.
2. Stripe has an incident (or the secret key is rotated and not yet updated,
   which `runbook.md` §"Rotating secrets" explicitly describes as a real
   window).
3. A customer fills the checkout form and clicks **Pay $54.99**.
4. `stripe.checkout.sessions.create` throws. The button says "Placing order…"
   for a second, then reverts to "Pay $54.99". No error text appears.
5. The customer clicks again. And again. Each click creates one more `pending`
   order (`createOrder` runs before the provider call) — three orphan orders,
   zero feedback.

### Impacto

- Segurança: nenhum
- Correção: alto (orphan orders, no signal)
- Performance: baixo
- Manutenção: médio
- UX: **crítico** (the single worst place in the app for a silent failure)

### Severidade

**P1**

### Recomendação

1. Wrap the call:
   ```ts
   let result: CheckoutActionResult;
   try {
     result = await checkoutAction(values);
   } catch (err) {
     // NEXT_REDIRECT must be re-thrown so Next can perform the navigation.
     if (isRedirectError(err)) throw err;
     captureException(err);
     setServerError("We couldn't start your payment. No charge was made — please try again in a moment.");
     return;
   }
   ```
   `isRedirectError` is available from `next/navigation` (`unstable_rethrow`
   in Next 16 does this correctly — prefer it). **Verify which helper Next
   16.2 exports before writing the code**; getting this wrong turns a working
   redirect into a swallowed error.
2. Move `createPayment` **before** the redirect but make the whole
   create-order → create-session → create-payment sequence recoverable: if the
   provider call throws, mark the just-created order `cancelled` (needs
   ECM-06's transition) so it isn't left dangling.
3. Apply the same `try/catch` shape to the other actions called from client
   handlers without one: `admin/order-actions.tsx`, `admin/user-role-button.tsx`,
   `admin/category-manager.tsx`, `admin/product-image-manager.tsx`,
   `address-book.tsx`, `cart-line-item.tsx` (`handleRemove`),
   `address-form.tsx`, `admin/banner-form.tsx`, `admin/category-form.tsx`.
   The last three are the worst of the set: they have **no error state at
   all**, and call `onDone()` unconditionally after `await` — so a failed save
   closes the form exactly as a successful one does, and the user believes
   their edit was persisted.

### Dependências

- Step 2 depends on **ECM-06** (a `cancelled` transition must exist).
- Overlaps with **ECM-07** (checkout idempotency); do ECM-07 after this.

### Testes necessários

- Component test (needs TST-01 tooling): mock `checkoutAction` to reject →
  assert an alert with the recovery message renders and the submit button is
  re-enabled.
- Component test: mock `checkoutAction` to throw a redirect error → assert it
  propagates (does not render an error message).
- Integration: with a payment provider stubbed to throw, assert no orphan
  `pending` order without a payment row survives.

---

## IMG-01 An admin-entered image URL on a non-allowlisted host breaks the page that renders it

**Confidence: Likely** (behaviour of `next/image` on an unconfigured remote
host — see "Verification" below)

### Localização

- `apps/web/next.config.ts:8-26` (`images.remotePatterns` — only
  `picsum.photos`, `localhost:9000`, `*.public.blob.vercel-storage.com`)
- `apps/web/lib/schemas/banner.ts:6` (`imageUrl: z.string().url()` — any host)
- `apps/web/lib/schemas/category.ts:10` (`imageUrl: z.string().url()` — any host)
- `apps/web/components/hero-carousel.tsx:34-42` (`<Image src={current.imageUrl}>`)
- `apps/web/components/featured-categories.tsx:23-29` (`<Image src={category.imageUrl}>`)

### Problema

Banner and category image URLs are free-text fields validated only as
"parses as a URL". They are then passed straight to `next/image` on the
**landing page**, which optimises remote images and therefore requires the
host to appear in `images.remotePatterns`.

The admin UI offers no host restriction, no allowlist hint, and no preview.
`BannerForm` at `banner-form.tsx:70` is a plain text input.

Note the contrast with `product-image-manager.tsx:108`, which passes
`unoptimized` — so admin-uploaded *product* images render regardless of host.
The landing-page components do not.

### Por que isso é um problema

An admin performing an ordinary, sanctioned action (adding a promo banner with
an image hosted anywhere other than picsum/MinIO/Vercel Blob) can take the
**homepage** down. There is an `error.tsx` boundary, so the user sees
"Something went wrong" rather than a blank page — but the homepage is
unusable until an admin realises the banner is the cause, which is not
discoverable from the error text.

### Cenário que reproduz o problema

1. Sign in as admin → `/admin/banners` → **Add banner**.
2. Title: "Summer Siege". Image URL:
   `https://images.unsplash.com/photo-1234`. Placement: hero. Active: yes.
3. Save. Visit `/`.
4. `HeroCarousel` renders `<Image src="https://images.unsplash.com/…">`. The
   host is not in `remotePatterns`.
5. Expected: the storefront `error.tsx` renders instead of the homepage.

### Verification

Before implementing, confirm the failure mode in this Next version — it
determines whether this is P1 or P3:

```bash
pnpm --filter @medivi/web dev
```
then add a banner with an off-allowlist URL and load `/`. If the page renders
with a broken image instead of throwing, downgrade this to **P3** (cosmetic)
and only apply recommendation 2 below. Next's documented behaviour is to throw
`Error: Invalid src prop … hostname "x" is not configured under images`, which
is why this is filed as P1.

### Impacto

- Segurança: baixo
- Correção: alto
- Performance: nenhum
- Manutenção: médio
- UX: alto (homepage outage triggered by a normal admin action)

### Severidade

**P1** (pending the verification above)

### Recomendação

Do all three:

1. **Validate the host at the boundary.** Export the allowed hostnames from a
   single module consumed by both `next.config.ts` and the Zod schemas:
   ```ts
   // apps/web/lib/image-hosts.ts
   export const ALLOWED_IMAGE_HOSTS = ["picsum.photos", "localhost", "*.public.blob.vercel-storage.com"] as const;
   ```
   Add a `.refine()` to `bannerSchema.imageUrl` and `categorySchema.imageUrl`
   rejecting other hosts with a message naming the allowed ones.
2. **Fail soft at render.** Wrap the banner/category image in a small
   `SafeRemoteImage` component that falls back to `unoptimized` (or a
   placeholder `div`) when the host isn't allowlisted, so a bad row can never
   take a page down even if validation is bypassed.
3. **Prefer uploads over URLs.** Longer term, banner and category images
   should go through `uploadProductImageAction`'s sibling — the same
   `StorageProvider` path products already use — rather than accepting
   arbitrary URLs. That also removes the SSRF-adjacent surface of pointing the
   image optimiser at an attacker-chosen host.

### Dependências

Recommendation 1 shares the hostname list with **CFG-02** (self-host MinIO
host mismatch). Do CFG-02 first so the list is already correct.

### Testes necessários

- Unit: `bannerSchema` rejects `https://evil.example/x.png` and accepts an
  allowlisted host.
- Integration/E2E: create a banner with an off-allowlist URL via the action →
  assert it is rejected; force a bad row directly in the DB → assert `/`
  still renders (fallback path).

---

## FE-02 Cart quantity stepper loses updates on rapid clicks and has no optimistic UI

**Confidence: Confirmed**

### Localização

`apps/web/components/cart-line-item.tsx:21-28, 67-89`

### Problema

```ts
function changeQuantity(next: number) { … updateCartItemAction({ itemId, quantity: next }) … }
…
onClick={() => changeQuantity(item.quantity + 1)}
```

The action takes an **absolute** quantity, computed from the `item.quantity`
prop. That prop only changes after the Server Action completes, the layout is
revalidated, and the new RSC payload is applied.

Two consequences:

1. **Lost updates.** The `+` button is disabled while `isPending`, which covers
   most cases — but `useTransition`'s pending state ends when the action
   resolves, while the *prop* only updates after revalidation lands. In the
   gap, a second click sends `item.quantity + 1` computed from the stale
   value. Net effect of two fast clicks: +1, not +2. Silent, no error.
2. **No optimistic feedback.** Every ±1 costs a full round trip *plus* a
   `revalidatePath("/", "layout")` (PERF-01) that re-renders the entire page
   tree. On a slow connection the number visibly lags the click by a second or
   more, with only `disabled` as feedback.

`handleRemove` (line 30) has no error handling at all — if the action throws,
the item stays visible and nothing is reported.

### Cenário que reproduz o problema

Open the cart drawer on a throttled connection (Slow 3G in devtools). Click
`+` three times in quick succession. Observe: quantity ends at 2, not 4. No
error is shown.

### Impacto

- Segurança: nenhum
- Correção: médio (cart quantity silently differs from user intent)
- Performance: médio (full-layout revalidation per click)
- Manutenção: baixo
- UX: alto

### Severidade

**P2**

### Recomendação

1. Change `updateCartItemAction` to accept a **delta** (`{ itemId, delta }`)
   or keep absolute but have the server compute from the current row rather
   than trusting the client's number. Delta is simpler and race-free:
   `UPDATE cart_item SET quantity = quantity + $delta WHERE id = … AND quantity + $delta BETWEEN 1 AND <stock>`.
   Keep a separate `setCartItemQuantity` for a future numeric input.
2. Add `useOptimistic` for the displayed quantity and line total, reverting on
   a non-ok result.
3. Add a `try/catch` to `handleRemove` with a `role="alert"` message.
4. Depends on PERF-01: narrow the revalidation so a quantity change doesn't
   re-render the catalog.

### Dependências

Do after **PERF-01** (revalidation scope) — otherwise the optimistic update is
immediately clobbered by a full-layout re-render.

### Testes necessários

- Component test: click `+` twice before the first action resolves; assert two
  distinct deltas reach the server and the final quantity is +2.
- Integration: `updateCartItemQuantity` with a delta that would exceed stock
  returns `insufficient_stock` and does not change the row.
- Component test: a rejecting `removeCartItemAction` renders an alert.

---

## FE-03 The search bar pushes a history entry per debounce tick, breaking the back button

**Confidence: Confirmed**

### Localização

`apps/web/components/search-bar.tsx:23-33` (`router.push`, `DEBOUNCE_MS = 400`)

### Problema

`handleChange` debounces 400 ms and then calls `router.push(...)`. Every pause
longer than 400 ms while typing creates a **new history entry**. Typing
"longsword" with natural pauses after "long" and "longsw" produces three
entries: `/search?q=long`, `/search?q=longsw`, `/search?q=longsword`.

Pressing Back then walks backwards through the user's own keystrokes instead
of returning to the page they came from. On a slower typist this can be five
or six entries per search.

### Cenário que reproduz o problema

From `/product/iron-longsword`, click the search box, type "shield" with a
normal pause mid-word, then press Back twice. Expected: back at the product
page. Actual: `/search?q=shie`.

### Impacto

- Correção: nenhum
- UX: alto (a broken Back button is one of the most-noticed defects on a
  storefront)
- Others: nenhum

### Severidade

**P2**

### Recomendação

Use `router.replace` for the debounced/automatic navigation and `router.push`
only for the explicit form submit (Enter / search button). One-line change in
`navigate()`, plus a `push` flag:

```ts
function navigate(q: string, { push = false } = {}) {
  const trimmed = q.trim();
  const href = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search";
  (push ? router.push : router.replace)(href);
}
```

While here, fix **FE-05**: `SiteHeader` renders `<SearchBar />` with no
`initialQuery`, so on `/search?q=sword` the header input is empty. Pass the
active query down (the header is a Server Component and can read it, or the
search page can render its own bound instance).

### Testes necessários

E2E: from a product page, type a multi-part query into the header search, then
`page.goBack()` once — assert the URL is the product page.

---

## A11Y-01 The hero carousel auto-rotates with no pause control (WCAG 2.2.2)

**Confidence: Confirmed**

### Localização

`apps/web/components/hero-carousel.tsx:11, 16-22`

### Problema

```ts
const ROTATE_INTERVAL_MS = 6000;
useEffect(() => {
  if (banners.length < 2) return;
  const timer = setInterval(() => setIndex(i => (i + 1) % banners.length), ROTATE_INTERVAL_MS);
  return () => clearInterval(timer);
}, [banners.length]);
```

The carousel advances every 6 seconds indefinitely. There is:

- no pause/stop control,
- no pause on hover or on keyboard focus,
- no `prefers-reduced-motion` check,
- no `aria-live` announcement of the change (so a screen-reader user gets no
  notice that the content under them changed).

`spec.md` §9 sets the target at **WCAG 2.2 AA**. Success Criterion 2.2.2
(Pause, Stop, Hide, Level A) requires that any automatically-moving content
that starts automatically, lasts more than five seconds, and is presented in
parallel with other content, has a mechanism to pause, stop or hide it. This
fails it.

The prev/next/dot controls exist but only change the slide — they do not stop
the timer, so an interacting user is still interrupted 6 seconds later.

### Por que isso é um problema

It is a Level A failure in a project that explicitly targets AA, on the
homepage — the page most likely to be audited. It also affects users with
vestibular or attention-related disabilities, and anyone trying to read a
banner's subtitle.

The reason this was never caught: `tasks.md` 10.2 ran axe against the landing
page, but **no hero banners were seeded**, so the carousel rendered nothing
(`hero-carousel.tsx:24` returns `null` on an empty list). Automated axe would
not catch 2.2.2 anyway — it is not machine-detectable.

### Impacto

- Acessibilidade: alto (WCAG 2.2 Level A failure)
- UX: médio
- Others: nenhum

### Severidade

**P2**

### Recomendação

1. Add a visible pause/play toggle button inside the carousel with an
   accessible name that reflects state (`"Pause promotions"` / `"Play
   promotions"`).
2. Pause on `mouseenter`/`focusin`, resume on `mouseleave`/`focusout`.
3. Stop auto-rotation permanently once the user operates any control
   (prev/next/dot) — interacting is an implicit "stop".
4. Respect motion preference:
   ```ts
   const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
   if (reduced) return; // no interval
   ```
5. Wrap the slide content in a container with `aria-live="polite"` and
   `aria-atomic="true"`, and add `aria-roledescription="carousel"` on the
   section.

### Dependências

None. Also seed at least one hero banner (`packages/db/src/seed-catalog.ts`
inserts none) so this component is actually exercised in dev/E2E/axe runs.

### Testes necessários

- E2E: load `/` with ≥2 seeded hero banners → assert the pause button exists,
  press it → wait 8 s → assert the slide has not changed.
- E2E with `prefers-reduced-motion: reduce` (`page.emulateMedia`) → assert no
  auto-advance.
- Axe scan of `/` **with banners present** (currently the seed has none, which
  is why 10.2's scan missed this).

---

## SEO-01 Sitemap silently truncates at 100 products; no canonical, Open Graph or Twitter metadata

**Confidence: Confirmed**

### Localização

- `apps/web/app/sitemap.ts:16` (`listProducts(db, { pageSize: 100 })`)
- `packages/db/src/queries/products.ts:43` (`MAX_PAGE_SIZE = 100`)
- `apps/web/app/layout.tsx:27-30`, `product/[slug]/page.tsx:15-27`,
  `catalog/page.tsx:5-7`, `search/page.tsx:5-12`,
  `catalog/[category]/page.tsx:5-12` (all metadata definitions)
- `apps/web/app/robots.ts:10`

### Problema

Three separate SEO gaps:

1. **Truncated sitemap.** `sitemap.ts` requests `pageSize: 100`, and
   `listProducts` clamps to `MAX_PAGE_SIZE = 100` anyway. There is no
   pagination loop. Product 101 onward never appears in `sitemap.xml`, with no
   warning. The seed has 36 products so this is invisible today and becomes a
   silent SEO regression the moment the catalog grows.

2. **No canonical / OG / Twitter tags.** `spec.md` §10 requires *"Per-page
   `generateMetadata` (title, description, canonical URL, Open Graph + Twitter
   card images)"*. Every `generateMetadata` in the app sets only `title` and
   sometimes `description`. There is no `metadataBase`, no
   `alternates.canonical`, no `openGraph`, no `twitter`.
   Concrete consequence: `/catalog?sort=price-asc&material=Iron&page=2` and
   `/catalog` are indexable as distinct URLs with identical `<title>` and no
   canonical — textbook duplicate content. Product links shared on
   social/chat render with no preview card.

3. **`robots.ts` under-blocks.** It disallows `/admin`, `/account`, `/api`,
   `/cart`, `/checkout` — but **not** `/order/confirmation/*` (which renders a
   full name, street address, email and order contents with no auth — see
   SEC-08), `/orders/lookup`, `/wishlist`, `/sign-in`, `/sign-up`, or
   `/checkout/mock/*`.

Also minor: `catalog/[category]/page.tsx:11` builds the title from the raw
**slug**, producing `"swords — Medivi Shop"` instead of `"Swords — Medivi
Shop"`, and does not 404-guard, so an unknown category gets a metadata title
before `CatalogView` calls `notFound()`.

### Cenário que reproduz o problema

*(1)* Seed 150 products, run `curl localhost:3000/sitemap.xml | grep -c
'/product/'` → 100.
*(2)* Paste a product URL into Slack/Discord/X → an unstyled link, no image,
no description.
*(3)* `curl localhost:3000/robots.txt` → `/order/confirmation` is crawlable.

### Impacto

- Segurança: baixo (item 3 → PII in a search index; see SEC-08)
- Correção: médio
- Performance: nenhum
- Manutenção: baixo
- UX/SEO: alto (a storefront that can't be shared or fully indexed)

### Severidade

**P2**

### Recomendação

1. **Sitemap:** loop pages until `page > totalPages`, or add a dedicated
   `listAllProductSlugs(db)` query returning `{slug, updatedAt}` with no cap.
   Add `lastModified` from `product.updatedAt` and `category.updatedAt`. If a
   cap is ever wanted, `console.warn` the number dropped — never truncate
   silently.
2. **Metadata:** add `metadataBase: new URL(env.NEXT_PUBLIC_APP_URL)` to the
   root layout, then per page:
   - `alternates: { canonical: "/product/" + slug }`
   - `openGraph: { title, description, url, images: [firstImage], type: "website" }`
   - `twitter: { card: "summary_large_image", … }`
   For `/catalog` and `/search`, set the canonical to the **unfiltered** path
   so filter permutations collapse to one indexable URL, and add
   `robots: { index: false }` when any filter/sort/page param is present.
3. **robots.ts:** add `/order/`, `/orders/`, `/wishlist`, `/sign-in`,
   `/sign-up`, `/forgot-password`, `/reset-password`, `/checkout/mock`.
4. Fix the category title to use the resolved category **name** (already
   available from `listCategoryTree`), and `notFound()` in `generateMetadata`
   for an unknown slug.

### Dependências

Item 2's `images` field wants a real OG image; `IMG-01`'s hostname allowlist
work should land first so OG image URLs are validated the same way.

### Testes necessários

- Integration: seed 120 products → assert `sitemap()` returns 120 product URLs.
- Integration: `generateMetadata` for a product returns a canonical matching
  `NEXT_PUBLIC_APP_URL` + `/product/<slug>` and an `openGraph.images` entry.
- Unit: `robots()` output contains each newly-disallowed path.
- E2E: `/catalog?page=2` response HTML contains `<meta name="robots" content="noindex">`.

---

## Remaining frontend findings (P3)

| ID | Finding | Localização | Impacto & Recomendação |
|---|---|---|---|
| **FE-04** | `AnalyticsBeacon` has no `useRef` guard, unlike `CheckoutCompletedBeacon`. In React Strict Mode (dev) every mount double-fires a `page_view`. In production the effect runs once per `pathname` change, so live data is fine — but dev/E2E funnel numbers are inflated. Also, a `/checkout` reload re-fires `checkout_started`. | `components/analytics-beacon.tsx:20-27` | Manutenção: baixo. Add the same `firedRef` pattern keyed by pathname. Low value; do it when touching the file. |
| **FE-05** | Header `SearchBar` is rendered with no `initialQuery`, so on `/search?q=sword` the input is empty and re-submitting loses the query. | `components/site-header.tsx:29-31` vs `search-bar.tsx:18` | UX: médio. Read `q` in `SiteHeader` (it's a Server Component) or render a page-local search bar on `/search`. Bundle with FE-03. |
| **FE-06** | Requesting a page beyond `totalPages` returns `items: []` while `total > 0`, so `CatalogView` renders "No products found" even though products exist. Similarly, `minPrice > maxPrice` silently yields zero results with no explanation. | `components/catalog-view.tsx:117-125`, `queries/products.ts:183-200` | UX: médio. Clamp `page` to `totalPages` in `listProducts` (or redirect to the last page), and show a distinct "no results for these filters — clear filters" state that keeps the filter chips visible. |
| **FE-07** | Destructive actions have no confirmation: delete category, delete variant, delete product image, delete address. All fire on a single click. | `admin/category-manager.tsx:72`, `admin/variant-manager.tsx:130`, `admin/product-image-manager.tsx:110`, `address-book.tsx:42-50` | UX: médio, Correção: médio (image delete is irreversible — it also removes the object from storage). Add a `Dialog` confirm (the primitive already exists in `packages/ui`). Prioritise the image and variant deletes. |
| **FE-08** | `updateCartItemAction` / `removeCartItemAction` return `{ok:true}` / `void` when the cart or item doesn't exist, so the UI reports success for a no-op. | `lib/actions/cart.ts:55,67`; `queries/cart.ts:186,199,214` | Correção: baixo. Return a `not_found` reason and have the client refresh, so a stale drawer (e.g. item removed in another tab) self-corrects instead of appearing to succeed. |
| **FE-09** | `ProductGallery` thumbnails use `role="tablist"`/`role="tab"` with no `tabpanel` and no `aria-controls` — an invalid ARIA pattern that misleads screen readers. The zoom overlay is `role="dialog" aria-modal="true"` with no focus trap, no initial focus move, and no focus restore; Escape works but Tab escapes the dialog. | `components/product-gallery.tsx:74-91, 94-109` | Acessibilidade: médio. Replace tablist with a plain list of buttons plus `aria-current`, and either use the existing `Dialog` primitive from `packages/ui` (which handles focus) or add focus management manually. |
| **FE-10** | `NewsletterForm` shows "Thanks — you're on the list." while storing nothing anywhere. | `components/newsletter-form.tsx:8-21` | UX: médio (misleading), documented as intentional in `tasks.md` 9.2. **Question** — decide: either persist it (a `newsletter_subscriber` table + Server Action) or change the copy to something honest like "Newsletter signup is a demo — nothing is stored." For a portfolio piece the second is a stronger signal than a fake success state. |
| **FE-11** | `entry.createdAt.toLocaleString()` and `.toLocaleDateString()` are called in Server Components, so dates render in the **server's** locale and timezone, not the viewer's. | `admin/audit-log/page.tsx` (When), `admin/users/page.tsx` (Joined), `admin/orders/page.tsx` (Placed), `app/(account)/account/orders/page.tsx` (order date) | UX: baixo, Correção: baixo. Compounds DB-02 (timezone-naive columns). Render an ISO string in a `<time dateTime>` and format client-side, or fix the timezone story first (DB-02) and format explicitly in UTC. |
| **FE-14** | On `/wishlist`, removing an item only flips the heart. `toggleWishlist` calls `revalidatePath("/wishlist")`, but `WishlistButton` never triggers a router refresh, so the removed card stays on screen until a manual reload — on the one page where the item should disappear. | `components/wishlist-button.tsx:26-32`, `app/(account)/wishlist/page.tsx:29-33`, `lib/actions/wishlist.ts:25` | UX: médio. Add a `router.refresh()` after a successful toggle, or an optional `onRemoved` callback so the wishlist page can drop the card optimistically. Bundle with FE-08. |
| **FE-12** | `sortVariantsForDisplay`'s comparator returns `0` whenever *either* operand lacks a recognised `size` attribute, making it non-transitive. `Array.prototype.sort` with an inconsistent comparator gives implementation-defined ordering, so a product mixing sized and unsized variants can order differently between runs. | `queries/products.ts:315-322` | Correção: baixo, UX: baixo. Map each variant to a sort key up front (`rank = SIZE_ORDER.indexOf(size)`, unranked → `Number.MAX_SAFE_INTEGER`), then compare keys — a total order. Add a unit test with a mixed set. |

---

## Browser-scenario review

Checked against `plan.md`/`spec.md` claims:

| Scenario | Behaviour | Verdict |
|---|---|---|
| **Refresh mid-cart** | Cart is server-backed via a 30-day httpOnly signed cookie. Survives refresh. | ✅ |
| **Refresh on `/order/confirmation/[id]`** | Re-reads the order; `CheckoutCompletedBeacon`'s `useRef` guard is per-mount, so a reload fires a duplicate `checkout_completed`. Funnel counts distinct sessions so the dashboard is unaffected; raw event counts are inflated. | ⚠️ minor (FE-04 family) |
| **Back/forward** | Broken by the search bar (FE-03). Catalog filters are URL-synced and back-safe. ✅ for catalog. | ⚠️ FE-03 |
| **Multiple tabs** | Cart state can diverge: tab A removes an item, tab B still shows it and its actions silently no-op (FE-08). Checkout in two tabs creates two orders from one cart (ECM-07). | ⚠️ FE-08, ECM-07 |
| **Slow connection** | No optimistic UI anywhere; every mutation is a full round trip plus a whole-layout revalidation (PERF-01). Add-to-cart shows "Adding…"; quantity shows only `disabled`. | ⚠️ FE-02, PERF-01 |
| **Connection lost mid-action** | Server Action rejects → most handlers have no catch → silent failure. Checkout is the worst case (FE-01). | ⚠️ FE-01 |
| **Session expires mid-checkout** | `checkoutAction` calls `getSession()`; with no session and no `guestEmail` in the payload it returns `guest_email_required` — which renders as "Enter an email address to check out as a guest" while the form is showing no email field (it was hidden because `userEmail` was non-null at render). The user sees an error they cannot act on. | ❌ **new, see below** |
| **API returns an error** | Covered above per surface. | ⚠️ |

### FE-13 Session expiry mid-checkout produces an unactionable error

**Confidence: Confirmed** · **Severidade: P2**

**Localização:** `apps/web/components/checkout-form.tsx:19, 66-83` +
`apps/web/lib/actions/checkout.ts:40-43`

**Problema:** `CheckoutForm` decides whether to render the email field from
`userEmail`, captured at server-render time. If the session expires between
page render and submit, `checkoutAction` takes the `!session && !guestEmail`
branch and returns `guest_email_required`. The form renders
*"Enter an email address to check out as a guest"* — but `isGuest` is still
`false`, so **there is no email input on screen**. The user is told to fill a
field that doesn't exist, with no path forward except a manual reload.

`spec.md` §7 explicitly lists this case: *"Session expires mid-checkout → user
is redirected to sign-in with cart/checkout state preserved server-side."*
That redirect does not exist.

**Recomendação:** on `guest_email_required` when the form was rendered in
authenticated mode, redirect to `/sign-in?redirectTo=/checkout` (the sign-in
page already accepts `redirectTo` — though note it currently **ignores** it,
see BE-09 below). Alternatively, always render the email field, pre-filled and
read-only for signed-in users; then the guest path is always available.

**Testes necessários:** integration — render the form with `userEmail` set,
clear the session cookie, submit → assert a redirect to `/sign-in?redirectTo=/checkout`
and that the cart is intact afterwards.

### BE-09 `redirectTo` is set by the proxy but never honoured

**Confidence: Confirmed** · **Severidade: P2**

**Localização:** `apps/web/proxy.ts:19` sets
`signInUrl.searchParams.set("redirectTo", request.nextUrl.pathname)`.
`apps/web/app/(account)/sign-in/sign-in-form.tsx:53` hardcodes
`router.push("/account")`. `sign-in/page.tsx` never reads the param.

**Problema:** an unauthenticated user hitting `/account/orders/abc` is
redirected to `/sign-in?redirectTo=/account/orders/abc`, signs in
successfully, and lands on `/account` — losing their destination. The
parameter is computed and discarded.

**Recomendação:** read `redirectTo` from `searchParams` in `sign-in/page.tsx`,
pass it into `SignInForm`, and use it in the `router.push`. **Validate it**:
accept only same-origin, path-only values starting with a single `/` and not
`//` — otherwise this becomes a second open redirect (compare SEC-02).

**Testes necessários:** E2E — visit `/account/addresses` signed out, sign in,
assert you land on `/account/addresses`. Unit — `redirectTo=https://evil.com`
and `redirectTo=//evil.com` both fall back to `/account`.
