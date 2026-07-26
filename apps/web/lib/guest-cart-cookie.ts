import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { env } from "./env";

const COOKIE_NAME = "medivi_guest_cart";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sign(token: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(token).digest("hex");
}

function verify(token: string, signature: string): boolean {
  const expected = Buffer.from(sign(token), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Reads the guest cart token from the signed cookie, if present and valid.
 * A missing or tampered signature is treated the same as no cookie at all
 * (see docs/plan.md §6) — never throws.
 */
export async function readGuestCartToken(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const separatorIndex = raw.lastIndexOf(".");
  if (separatorIndex === -1) return null;
  const token = raw.slice(0, separatorIndex);
  const signature = raw.slice(separatorIndex + 1);
  if (!token || !signature) return null;

  try {
    return verify(token, signature) ? token : null;
  } catch {
    return null;
  }
}

async function setGuestCartCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, `${token}.${sign(token)}`, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Only callable from a Server Action/Route Handler — reads or mints a guest cart token, setting the cookie if new. */
export async function getOrCreateGuestCartToken(): Promise<string> {
  const existing = await readGuestCartToken();
  if (existing) return existing;

  const token = randomUUID();
  await setGuestCartCookie(token);
  return token;
}

export async function clearGuestCartCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
