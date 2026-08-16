# 09 — Edge cases

A failure-mode matrix per flow. Each row states the input/condition, the
**actual** behaviour (read from the code, not assumed), a verdict, and the
finding that tracks it.

Legend: ✅ handled correctly · ⚠️ partially handled or degraded · ❌ broken
· ❓ undefined behaviour needing a decision

---

## 1. Against the spec's own list

`spec.md` §7 enumerates eleven edge cases the project committed to handling.
Verified one by one:

| # | Spec'd edge case | Actual | Verdict |
|---|---|---|---|
| 1 | Item out of stock between add-to-cart and checkout → block, surface per-line error | `createOrder` returns `stock_or_price_changed` with an itemised `issues[]`; `CheckoutForm` renders each one | ✅ |
| 2 | Concurrent purchases racing the last unit → transactional decrement, loser fails cleanly, no double-pay | Guarded `UPDATE … WHERE stock >= qty` + a real two-connection test. **Correct for single-line orders; broken for multi-line** | ⚠️ **ECM-01** |
| 3 | Price change between add-to-cart and checkout → snapshot + re-validate + flag | Implemented and tested (`checkout.test.ts` *"blocks checkout when the cart price drifted"*) | ✅ |
| 4 | Duplicate Stripe webhook → de-duplicated by event id, idempotent | `processed_webhook_event` insert with `onConflictDoNothing` inside the same transaction; tested both ways | ✅ |
| 5 | Session expires / user abandons → order stays `pending`, admin-visible, retryable | Stays `pending` ✅, admin-visible ✅ — but **nothing ever moves it out**, there is no cancel action, and the "scheduled" half doesn't exist | ⚠️ **ECM-06** |
| 6 | Guest checkout with an email that already has an account → not auto-linked; prompt to sign in, or guest lookup | Not auto-linked ✅; guest lookup works ✅. There is **no prompt to sign in** anywhere in the checkout or confirmation flow | ⚠️ minor gap |
| 7 | Cart merge when both carts hold the same product → sum, clamp to stock | Implemented ✅ — but clamping to **zero** silently drops the item with no user feedback, and the merge is not transactional | ⚠️ **ECM-09** |
| 8 | Delete a category with products → block with a clear error | Blocked on products **and** on child categories; typed reasons; clear UI messages | ✅ (better than spec'd) |
| 9 | Invalid/oversized image upload → validated client- and server-side, no partial save | Type + 5 MB size + 200–4000 px dimensions, validated on both sides with `image-size` as the server authority | ✅ |
| 10 | Session expires mid-checkout → redirect to sign-in with cart preserved | Cart is preserved ✅ (server-backed). **No redirect** — the user gets "enter an email" with no email field on screen | ❌ **FE-13** |
| 11 | Refund an already-refunded or unpaid order → blocked, only valid from `paid`/`fulfilled` | Blocked ✅ — but the **provider refund runs before the check**, so an invalid-state refund still moves money | ⚠️ **ECM-03** |

**Score: 5 fully handled, 5 partial, 1 broken.**

---

## 2. Catalog & search

| Condition | Actual behaviour | Verdict |
|---|---|---|
| `?page=0`, `?page=-5` | `parsePage` requires `Number.isInteger && > 0` → falls back to 1 | ✅ |
| `?page=abc` (storefront) | → 1 | ✅ |
| `?page=abc` (**admin**) | `Number("abc")` → `NaN` → `offset(NaN)` → SQL error → 500 | ❌ **BE-01** |
| `?page=99999` | `listProducts` returns `items: []` with `total > 0`; UI renders "No products found" although products exist | ⚠️ **FE-06** |
| `?minPrice=abc` | `parseDollarsToCents` → `undefined` → filter ignored silently | ⚠️ **FE-06** |
| `?minPrice=100&maxPrice=10` | Zero results, no explanation | ⚠️ **FE-06** |
| `?minPrice=-5` | Rejected by `dollars < 0` → ignored | ✅ |
| `?minPrice=1e309` | `Number` → `Infinity`; `Number.isFinite` false → ignored | ✅ |
| `?material=%25` | Reaches `ilike` as a wildcard → matches everything | ⚠️ **SEC-10** |
| `?material=<script>` | Parameterised; React escapes on render | ✅ |
| Empty search `?q=` | `.trim() \|\| undefined` → no search condition; full catalog | ✅ |
| `?q=` 10,000 chars | No length cap on `q`; `websearch_to_tsquery` handles it, `word_similarity` computes per row over a seq scan | ⚠️ minor — cap `q` at 200 chars (VAL-01 family) |
| `?q=` with tsquery metacharacters (`&`, `|`, `!`, `:`) | `websearch_to_tsquery` treats them as plain text by design (unlike `to_tsquery`) — correct choice | ✅ |
| Unknown category slug | `CatalogView` checks against `listCategoryTree` → `notFound()` | ✅ |
| Category with zero products | Renders the empty state | ✅ |
| Product with no images | `ProductGallery` renders a grey placeholder box | ✅ |
| Product with **zero variants** | `ProductVariantPanel` returns `null` → page has no price, no stock, no buy button, no error | ❌ **BE-04** |
| Variant sort with mixed sized/unsized variants | Non-transitive comparator → implementation-defined order | ⚠️ **FE-12** |

---

## 3. Cart

| Condition | Actual behaviour | Verdict |
|---|---|---|
| Add with no cookie and no session | `resolveOwnerForMutation` mints a signed guest cookie and creates a cart | ✅ |
| Add with a **tampered** cookie signature | `verify()` fails → treated as no cookie → a fresh cart is created transparently | ✅ (documented decision, `plan.md` §6) |
| Add with a cookie whose signature is non-hex | `Buffer.from(sig,"hex")` drops invalid chars; the length pre-check then fails before `timingSafeEqual` | ✅ |
| Add with a valid signature but a token no longer in the DB | `getOrCreateCart` creates a new cart with that token | ✅ |
| Add quantity 0 or negative | `z.number().int().positive()` rejects — but **throws** rather than returning a typed result | ⚠️ **BE-02** |
| Add quantity 100+ | `.max(99)` rejects, throws. The UI can reach 100+ if stock > 99 | ⚠️ **BE-02** |
| Add quantity > stock | `insufficient_stock` with `available` | ✅ |
| Add when existing + new > stock | Checked against the **combined** total, not just the increment | ✅ (tested) |
| Add to a variant with stock 0 | `out_of_stock` | ✅ |
| Add a **draft** or **archived** product's variant | **Succeeds** | ❌ **ECM-02** |
| Add a non-existent variant UUID | `{ok:false, reason:"out_of_stock", available:0}` — misleading reason but safe | ⚠️ minor |
| Two concurrent adds of the same variant | `cart_item_cart_variant_idx` UNIQUE prevents duplicate rows; the second insert would raise `23505`, which is **not caught** → 500 | ⚠️ narrow race; catch `isUniqueViolation` and retry as an increment |
| Two concurrent adds creating the cart | `getOrCreateCart` handles it with `onConflictDoNothing` + re-read | ✅ |
| Quantity `+` clicked rapidly | Absolute value from a stale prop → lost updates | ⚠️ **FE-02** |
| Update/remove an item id from **another** cart | Scoped by `cartId` in the WHERE → no rows affected | ✅ (no IDOR) |
| Update/remove when the cart no longer exists | Returns success for a no-op | ⚠️ **FE-08** |
| Item's product archived while in the cart | Still shown, still purchasable | ❌ **ECM-02** |
| Item's variant **deleted** while in the cart | `cart_item → product_variant` is `ON DELETE cascade` → the line disappears silently. `deleteVariantAdmin` is blocked only by ordered variants, so this is reachable | ⚠️ ❓ acceptable? The customer's cart silently shrinks. Prefer the ECM-02 "unavailable" treatment. |
| Cart older than 30 days | The cookie expires; the `cart` row is orphaned forever. No cleanup exists | ⚠️ add a retention command alongside DB-08/DB-09 |

---

## 4. Checkout & payment

| Condition | Actual behaviour | Verdict |
|---|---|---|
| Empty cart | `empty_cart` | ✅ |
| No session and no `guestEmail` | `guest_email_required` | ✅ (but see FE-13) |
| Session expires between render and submit | `guest_email_required` with no email field visible | ❌ **FE-13** |
| Stock dropped below cart quantity | Itemised `stock` issue, order not created | ✅ |
| Price changed since add-to-cart | Itemised `price` issue, order not created | ✅ |
| Product archived since add-to-cart | **No check** — order created | ❌ **ECM-02** |
| Submit clicked twice | Two orders, two payments, both live | ⚠️ **ECM-07** |
| Two browser tabs, both submit | Same | ⚠️ **ECM-07** |
| Back button after redirect, submit again | Same | ⚠️ **ECM-07** |
| Provider throws (Stripe down / bad keys) | Unhandled rejection; **no error shown**; orphan `pending` order with no payment row | ❌ **FE-01** |
| Provider returns no URL | `throw new Error("Stripe did not return a checkout URL")` → same as above | ❌ **FE-01** |
| Rate limit hit | `rate_limited` with a clear message | ✅ |
| Rate limit bypassed via forged `X-Forwarded-For` | Unlimited | ❌ **SEC-04** |
| No proxy at all (self-host) | Everyone shares the `"unknown"` bucket → 10 checkouts/min site-wide | ❌ **SEC-04** |
| User abandons at the provider | Order `pending` forever; nothing cancels it | ⚠️ **ECM-06** |
| Stripe session expires (24 h) | `checkout.session.expired` → payment `failed`, order **still** `pending` | ⚠️ **ECM-06** |
| Card declined at Stripe | **No event is handled** — `toPaymentEvent` maps only `checkout.session.completed` and `checkout.session.expired`. `payment_intent.payment_failed` returns `unhandled` → 200, nothing recorded | ❌ **ECM-06** (extend the event map) |
| Webhook arrives twice | `duplicate`, no-op | ✅ (tested) |
| Webhook arrives for a non-`pending` order | Payment marked `succeeded`, order unchanged, outcome `paid`, email sent | ❌ **ECM-04** |
| Webhook with a bad signature | 400, logged, nothing processed | ✅ (tested) |
| Webhook with no signature header | 400 | ✅ (tested) |
| Webhook with an unknown event type | 200, ignored, logged | ✅ (tested) |
| Webhook when `PAYMENT_PROVIDER=mock` | `MockProvider.verifyAndParseWebhook` throws → 400 | ✅ |
| Webhook amount ≠ order total | **Not checked** | ⚠️ **SEC-12** |
| Multi-line order, one line oversold | Partial decrement **committed**; customer charged; order `pending`; page says "not charged" | ❌ **ECM-01** |
| Confirmation page for a `refunded` order | "Thank you for your order!" | ❌ **ECM-10** |
| Confirmation page for a `cancelled` order | No status message at all | ❌ **ECM-10** |
| Confirmation page still `pending` after 20 s | Poller stops; page is stuck on "Payment processing" with no next step | ⚠️ **ECM-10** |
| Anyone with an order UUID hits `/checkout/mock/<id>` | **Approve payment** button renders and works, in any provider mode | ❌ **SEC-01** |
| `successUrl` set to an external origin | `redirect()` follows it | ❌ **SEC-02** |
| Email send fails after a successful payment | Caught and logged; the order stays `paid` | ✅ (correct — payment must not depend on email) |
| DB dies between `createOrder` and `createPayment` | Order exists with no payment row; confirmation page shows `pending` with `latestPaymentStatus: null` → "Payment processing" forever | ⚠️ **ECM-06/FE-01** |

---

## 5. Auth

| Condition | Actual behaviour | Verdict |
|---|---|---|
| Sign up with an existing **verified** email | Better Auth returns a fake success (anti-enumeration); UI shows "check your email" | ✅ (documented, tested on DB state) |
| Sign up with an existing **unverified** email | Reprocessed as a retry | ✅ |
| Sign in before verifying | `EMAIL_NOT_VERIFIED` → a resend-verification action | ✅ |
| Sign in with wrong credentials | Generic message | ✅ |
| Password < 8 chars | Client-side Zod + Better Auth server-side | ✅ |
| Sign-in brute force | Better Auth `rateLimit` — **production only** | ⚠️ **SEC-13** |
| Session cookie forged | `proxy.ts` lets it through (presence check only); `requireUser`/`requireAdmin` reject | ✅ (defence in depth working as designed) |
| Admin demoted while signed in | Keeps admin for up to 5 min (cookie cache) | ⚠️ **SEC-06** |
| Admin demotes themselves | Rejected (`reason: "self"`) | ✅ |
| Last admin demoted by another admin | **Allowed** — two admins can demote each other down to zero admins, locking everyone out. Only the self-demote case is blocked | ❓ **new** — see below |
| User deleted while signed in | Session cascade-deletes; cookie cache may still validate for 5 min | ⚠️ **SEC-06** |
| Reset link reused / expired | Better Auth rejects; the form shows the error | ✅ |
| Reset link with no token | The form renders "This reset link is missing or invalid" | ✅ |
| Sign in with a `redirectTo` in the URL | Ignored; always `/account` | ⚠️ **BE-09** |
| Welcome email fails during signup | `databaseHooks.user.create.after` throws → **the signup response may fail after the user row is committed** | ❓ **new** — see below |

### EDGE-01 The last admin can be demoted, locking everyone out

**Confidence: Confirmed** · **Severidade: P3**

**Localização:** `apps/web/lib/actions/admin-users.ts:24` —
`if (userId === admin.id) return { ok: false, reason: "self" };`

`tasks.md` 7.9 explains the self-demotion guard: *"without it the last admin
could demote themselves out of `/admin` with no way back short of a direct DB
edit."* The reasoning is right; the implementation only covers the
single-admin case. With two admins, A can demote B and B can demote A — the
second one to act leaves the system with **zero** admins and the same
unrecoverable state.

**Recomendação:** in `setUserRoleAdmin`'s transaction, when demoting, count
remaining admins and reject if it would reach zero:
```sql
SELECT count(*) FROM "user" WHERE role = 'admin' AND id <> $target
```
Return `{ ok:false, reason:"last_admin" }`. Keep the self-check too (a
clearer message for the common case).

**Testes necessários:** integration — with exactly one admin, demoting them
(by another admin, via a direct query-layer call) is refused; with two, one
demotion succeeds and the second is refused.

### EDGE-02 A failing welcome email may fail the signup response after the user is created

**Confidence: Likely** · **Severidade: P3**

**Localização:** `apps/web/lib/auth.ts:34-46`

```ts
databaseHooks: { user: { create: { async after(createdUser) {
  const { subject, html } = await renderWelcomeEmail(…);
  await getEmailProvider().send({ to: createdUser.email, subject, html });
} } } }
```

No `try/catch`. With `EMAIL_PROVIDER=console` this can't fail. With
`EMAIL_PROVIDER=resend`, `ResendProvider.send` **throws** on any API error
(`packages/email/src/providers/resend.ts:26-28`) — rate limit, invalid domain,
network blip.

Whether that fails the whole signup depends on how Better Auth treats a
throwing `after` hook. If it propagates, the user row is already committed but
the client sees an error and will retry — hitting the
"already registered → fake success" path, so they never get a working account
state and never receive the verification email either.

Contrast: `sendOrderConfirmationEmail` is correctly wrapped in `try/catch` and
logged (`lib/order-confirmation-email.ts:31-33`). The auth hooks are not.

**Verification:** set `EMAIL_PROVIDER=resend` with a deliberately invalid
`RESEND_API_KEY` and sign up. Observe whether the user row exists and what the
client sees.

**Recomendação:** wrap all three auth email hooks (`create.after`,
`sendVerificationEmail`, `sendResetPassword`) in `try/catch` + `logger.error`,
matching the order-confirmation pattern. A failed *verification* email is more
serious — the user cannot proceed — so also surface a "resend verification"
affordance, which the sign-in form already has.

**Testes necessários:** integration — with a provider stubbed to throw, signup
still creates the user and returns success, and the failure is logged.

---

## 6. Admin

| Condition | Actual behaviour | Verdict |
|---|---|---|
| Non-admin calls any admin action directly | `requireAdmin` → redirect | ✅ (tested per module) |
| Duplicate product/category slug | Typed `slug_taken` | ✅ |
| Duplicate variant SKU | Untyped throw → misleading "check the SKU is unique" for *any* error | ⚠️ **BE-03** |
| Delete a category with products / children | Blocked, typed reasons | ✅ |
| Delete a variant that has been ordered | Blocked by the restrict FK, typed `has_orders` | ✅ |
| Delete a product's **last** variant | Succeeds → an unbuyable product page | ❌ **BE-04** |
| Delete a product | Not offered — soft-delete via `archived` only | ✅ (correct: `order_item` restrict makes hard delete impossible) |
| Stock adjustment that would go negative | CHECK violation caught → `would_go_negative` | ✅ |
| Stock adjustment of `0` | Zod `.refine(n => n !== 0)` | ✅ |
| Stock adjustment of 3,000,000,000 | Postgres `22003`, not caught → 500 | ⚠️ **VAL-01** |
| Fulfil an order that isn't `paid` | `WHERE status = 'paid'` matches nothing → `invalid_state` | ✅ |
| Refund an order that isn't `paid`/`fulfilled` | Rejected — **but the provider refund already ran** | ❌ **ECM-03** |
| Refund twice (double-click) | No idempotency key; the first sets `refunded` so the second's payment-status check fails — **after** a second provider call | ⚠️ **ECM-03** |
| Refund when the provider errors | `provider_error` with the message; DB unchanged; **no audit row** | ⚠️ **ECM-03** |
| Refund → is stock restored? | No, and no inventory log | ❓ **ECM-05** (undocumented decision) |
| Banner with `endsAt` before `startsAt` | Accepted; never displays | ⚠️ add a cross-field `.refine` |
| Banner image URL on a non-allowlisted host | Homepage render fails | ❌ **IMG-01** |
| Banner `ctaHref = "javascript:…"` | Stored and rendered as an href | ⚠️ **SEC-09** |
| Category image URL on a non-allowlisted host | Same as banner | ❌ **IMG-01** |
| Upload a 6 MB image | `too_large` | ✅ |
| Upload a `.txt` renamed to `.png` | `file.type` check passes (client-set) but `imageSize()` throws → `invalid_file` | ✅ |
| Upload a 100×100 image | `invalid_dimensions`, both client and server | ✅ |
| Upload with no alt text | Falls back to the product name | ✅ |
| Upload when MinIO is down | `getStorageProvider().upload` throws → **unhandled** → 500 in the admin form after the dimension checks passed | ⚠️ wrap in try/catch and return `storage_error` |
| Delete an image | Removes the DB row **and** the storage object; no confirmation dialog | ⚠️ **FE-07** |
| Delete an image when storage deletion fails | The DB row is already deleted (the transaction committed) → an orphaned object in the bucket | ⚠️ minor; log it |
| `/admin/*?page=abc` | 500 | ❌ **BE-01** |
| Audit-log filter by a non-existent actor id | Empty state | ✅ |

---

## 7. Infrastructure & external dependencies

| Condition | Actual behaviour | Verdict |
|---|---|---|
| Postgres unavailable at boot | `packages/db/src/client.ts` creates a lazy pool; the first query throws → `error.tsx` | ⚠️ no health check to detect it (**CFG-03**) |
| Postgres unavailable mid-request | Unhandled throw → route-group `error.tsx` | ✅ (acceptable) |
| Connection pool exhausted | Documented in dev (`tasks.md` Phase 3). No `max`, no `idle_timeout` configured | ⚠️ **DB-03** |
| Upstash unavailable | `UpstashRateLimiter.limit` throws → **unhandled** in `checkoutAction` → checkout fails entirely | ❌ **new — see below** |
| Upstash not configured | Falls back to `MemoryRateLimiter` | ✅ |
| Resend unavailable | Order confirmation: caught, logged, order unaffected ✅. Auth emails: **not** caught | ⚠️ **EDGE-02** |
| MinIO / Blob unavailable | Upload throws unhandled | ⚠️ see admin table |
| MinIO bucket doesn't exist | `PutObjectCommand` fails; the compose stack never creates the bucket | ❌ **CFG-04** |
| Sentry not configured | Fully no-op, SDK never loaded | ✅ (verified — good) |
| Stripe API slow/timeout | `createCheckoutSession` has no timeout; the Server Action hangs until the SDK's default | ⚠️ set an explicit `timeout` on the Stripe client |
| Deployed at a real domain via Docker | Client-side auth calls target `http://localhost:3000` | ❌ **CFG-01** |
| Self-host product images | URLs point at `http://minio:9000` — unreachable from the browser and not in `remotePatterns` | ❌ **CFG-02** |

### EDGE-03 A rate-limiter outage takes checkout down entirely

**Confidence: Confirmed** · **Severidade: P2**

**Localização:** `apps/web/lib/actions/checkout.ts:37`,
`apps/web/app/api/webhooks/stripe/route.ts:20`,
`packages/ratelimit/src/providers/upstash.ts:17-20`

```ts
const rateLimit = await getCheckoutRateLimiter().limit(identifier);
if (!rateLimit.success) return { ok: false, reason: "rate_limited" };
```

`UpstashRateLimiter.limit` makes a network call to Upstash's REST API and does
not catch anything. If Upstash is unreachable, slow, or returns an error, the
promise rejects, `checkoutAction` throws, and — because of **FE-01** — the
customer sees nothing at all. A rate limiter outage becomes a **complete
checkout outage** with no error message.

The same applies to the webhook: a limiter failure rejects before signature
verification, so the handler throws and returns a 500. Stripe retries, so
events aren't lost, but every delivery fails while Upstash is down.

A rate limiter is a *protection* layer. Its failure mode should be
fail-**open** (allow the request, log loudly), not fail-closed-with-no-message.

**Recomendação:**
1. Wrap `limit()` in the provider itself:
   ```ts
   async limit(key: string): Promise<RateLimitResult> {
     try {
       const result = await this.ratelimit.limit(key);
       return { success: result.success, remaining: result.remaining };
     } catch {
       return { success: true, remaining: 0, degraded: true };   // fail open
     }
   }
   ```
   Add `degraded?: boolean` to `RateLimitResult` so callers can log it.
2. Log at `warn` when degraded, so an outage is visible.
3. Add a timeout (Upstash's client accepts one) so a hanging Upstash doesn't
   hold the request open.
4. Consider falling back to `MemoryRateLimiter` on repeated failures rather
   than fully open.

**Testes necessários:** unit — a provider stubbed to reject returns
`{success:true, degraded:true}`; integration — checkout still completes when
the limiter throws.

---

## 8. Concurrency matrix

The interesting simultaneous-action pairs, and whether they are safe:

| A | B | Outcome | Verdict |
|---|---|---|---|
| Two adds of the same variant to the same cart | | Unique index → one insert, one `23505` (uncaught) | ⚠️ catch and retry as increment |
| Two `getOrCreateCart` for the same owner | | `onConflictDoNothing` + re-read | ✅ |
| Two `getOrCreateWishlistId` for the same user | | Same pattern | ✅ |
| Two fulfilments racing the last unit (single-line) | | Row lock serialises; one `paid`, one `oversold` | ✅ (tested) |
| Two fulfilments racing, **multi-line** | | Partial decrement committed | ❌ **ECM-01** |
| Fulfilment + admin stock adjustment | | Both use guarded/CHECK'd updates on the same row → serialised | ✅ |
| Two checkouts from the same cart | | Two orders, both valid | ⚠️ **ECM-07** |
| Checkout + cart mutation in another tab | | `createOrder` reads the cart at validation time, outside a transaction → a line added in between is not included but also not rejected | ⚠️ **ECM-08** |
| Cart merge + concurrent add | | Merge is not transactional; an add landing mid-merge can be lost or double-counted | ⚠️ **ECM-09** |
| Two refunds of the same order | | Two provider calls possible | ⚠️ **ECM-03** |
| Two role changes on the same user | | Last write wins; both audited | ✅ |
| Address default promotion × 2 | | Both in transactions; demote-then-promote ordering makes them serialise correctly | ✅ (would be enforced by **DB-04**) |
| Webhook + mock approval for the same order | | Different `eventId`s (`mock_<id>_approved` vs Stripe's `evt_…`) → **both** would process. Only reachable with SEC-01 unfixed | ❌ **SEC-01** |

---

## 9. Data-lifecycle edge cases

Nothing in the system ever deletes anything on a schedule. These all grow
without bound:

| Table | Growth driver | Cleanup | Tracked |
|---|---|---|---|
| `analytics_event` | every page view, **unauthenticated** | none | **DB-09**, **SEC-05** |
| `processed_webhook_event` | every webhook | none | **DB-08** |
| `audit_log` | every admin mutation | none (append-only by design ✅) | DB-01 (indexes) |
| `order` (`pending`) | every abandoned checkout | none | **ECM-06** |
| `cart` (guest, expired cookie) | every guest who never returns | none | §3 above |
| `inventory_log` | every stock movement | none (correct — it's a ledger) | DB-01 (index) |
| MinIO/Blob objects | every upload; orphaned on failed DB delete | none | §6 above |

**Recomendação:** add one documented maintenance command
(`pnpm --filter @medivi/db maintenance`) covering: expire stale `pending`
orders (ECM-06), delete guest carts older than 60 days, delete
`analytics_event` older than 90 days, delete `processed_webhook_event` older
than 30 days. Document the retention periods in `spec.md` §6 or a new
`docs/operations.md`. This is a small script that materially raises the
"could a merchant actually run this" bar the spec sets in §1.
