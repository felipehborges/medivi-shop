import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
vi.mock("./auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } },
}));

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const { requireUser, requireAdmin } = await import("./auth-guards");

beforeEach(() => {
  getSessionMock.mockReset();
  redirectMock.mockClear();
});

describe("requireUser", () => {
  it("returns the user when a session exists", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "1", role: "customer" } });
    const user = await requireUser();
    expect(user.id).toBe("1");
  });

  it("redirects to /sign-in when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/sign-in");
  });
});

describe("requireAdmin", () => {
  it("returns the user when role is admin", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "1", role: "admin" } });
    const adminUser = await requireAdmin();
    expect(adminUser.role).toBe("admin");
  });

  it("redirects home when signed in but not admin", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "1", role: "customer" } });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/");
  });

  it("redirects to sign-in when there is no session at all", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/sign-in");
  });
});
