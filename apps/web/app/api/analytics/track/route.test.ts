import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { analyticsEvent, user } from "@medivi/db/schema";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
}));
vi.mock("server-only", () => ({}));

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

const { POST } = await import("./route");

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function trackRequest(body: unknown) {
  return new Request("http://localhost:3000/api/analytics/track", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

let userId: string;
const createdAnalyticsSessionIds: string[] = [];

beforeAll(async () => {
  const uid = unique("user");
  const [u] = await db.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com` }).returning();
  userId = u!.id;
});

afterEach(() => {
  const sessionId = cookieJar.get("medivi_analytics_session");
  if (sessionId) createdAnalyticsSessionIds.push(sessionId);
  cookieJar.clear();
  getSessionMock.mockReset();
});

afterAll(async () => {
  for (const sessionId of createdAnalyticsSessionIds) {
    await db.delete(analyticsEvent).where(eq(analyticsEvent.sessionId, sessionId));
  }
  await db.delete(user).where(eq(user.id, userId));
});

describe("POST /api/analytics/track", () => {
  it("records an anonymous page view and mints a session cookie", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await POST(trackRequest({ type: "page_view", path: "/catalog" }));
    expect(response.status).toBe(200);

    const sessionId = cookieJar.get("medivi_analytics_session");
    expect(sessionId).toBeTruthy();

    const [row] = await db.select().from(analyticsEvent).where(eq(analyticsEvent.sessionId, sessionId!));
    expect(row?.type).toBe("page_view");
    expect(row?.path).toBe("/catalog");
    expect(row?.userId).toBeNull();
  });

  it("attaches the signed-in user id when a session exists", async () => {
    getSessionMock.mockResolvedValue({ user: { id: userId } });

    const response = await POST(trackRequest({ type: "add_to_cart" }));
    expect(response.status).toBe(200);

    const sessionId = cookieJar.get("medivi_analytics_session");
    const [row] = await db.select().from(analyticsEvent).where(eq(analyticsEvent.sessionId, sessionId!));
    expect(row?.userId).toBe(userId);
  });

  it("reuses the same session id across repeated calls", async () => {
    getSessionMock.mockResolvedValue(null);

    await POST(trackRequest({ type: "page_view", path: "/a" }));
    const first = cookieJar.get("medivi_analytics_session");
    await POST(trackRequest({ type: "page_view", path: "/b" }));
    const second = cookieJar.get("medivi_analytics_session");

    expect(second).toBe(first);
  });

  it("rejects a malformed body without throwing", async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await POST(trackRequest({ type: "not_a_real_type" }));
    expect(response.status).toBe(400);
  });
});
