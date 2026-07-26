import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("getEmailProvider", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("./env");
  });

  it("returns a ConsoleEmailProvider by default", async () => {
    vi.doMock("./env", () => ({ env: { EMAIL_PROVIDER: "console" } }));
    const { getEmailProvider } = await import("./email");
    const { ConsoleEmailProvider } = await import("@medivi/email");
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("returns a ResendProvider when EMAIL_PROVIDER=resend with an API key configured", async () => {
    vi.doMock("./env", () => ({
      env: { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test_key", EMAIL_FROM: "test@example.com" },
    }));
    const { getEmailProvider } = await import("./email");
    const { ResendProvider } = await import("@medivi/email");
    expect(getEmailProvider()).toBeInstanceOf(ResendProvider);
  });

  it("throws when EMAIL_PROVIDER=resend but no API key is configured", async () => {
    vi.doMock("./env", () => ({ env: { EMAIL_PROVIDER: "resend" } }));
    const { getEmailProvider } = await import("./email");
    expect(() => getEmailProvider()).toThrow(/RESEND_API_KEY/);
  });

  it("caches the provider across repeated calls", async () => {
    vi.doMock("./env", () => ({ env: { EMAIL_PROVIDER: "console" } }));
    const { getEmailProvider } = await import("./email");
    expect(getEmailProvider()).toBe(getEmailProvider());
  });
});
