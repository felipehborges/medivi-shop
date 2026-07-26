import { describe, expect, it } from "vitest";
import { withTestTransaction } from "../test";
import { banner } from "../schema";
import { listActiveBanners } from "./banners";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("listActiveBanners", () => {
  it("returns only active, in-window banners for the given placement, ordered by sortOrder", async () => {
    await withTestTransaction(async (tx) => {
      const base = { imageUrl: "https://example.com/a.png" };

      const [inactive] = await tx
        .insert(banner)
        .values({ ...base, title: unique("inactive"), placement: "hero", isActive: false, sortOrder: 0 })
        .returning();
      const [wrongPlacement] = await tx
        .insert(banner)
        .values({ ...base, title: unique("wrong-placement"), placement: "category", isActive: true, sortOrder: 0 })
        .returning();
      const [notYetStarted] = await tx
        .insert(banner)
        .values({
          ...base,
          title: unique("future"),
          placement: "hero",
          isActive: true,
          sortOrder: 0,
          startsAt: new Date(Date.now() + DAY_MS),
        })
        .returning();
      const [expired] = await tx
        .insert(banner)
        .values({
          ...base,
          title: unique("expired"),
          placement: "hero",
          isActive: true,
          sortOrder: 0,
          endsAt: new Date(Date.now() - DAY_MS),
        })
        .returning();
      const [second] = await tx
        .insert(banner)
        .values({ ...base, title: unique("second"), placement: "hero", isActive: true, sortOrder: 2 })
        .returning();
      const [first] = await tx
        .insert(banner)
        .values({ ...base, title: unique("first"), placement: "hero", isActive: true, sortOrder: 1 })
        .returning();

      const active = await listActiveBanners(tx, "hero");
      const ids = active.map((b) => b.id);

      expect(ids).toEqual([first!.id, second!.id]);
      expect(ids).not.toContain(inactive!.id);
      expect(ids).not.toContain(wrongPlacement!.id);
      expect(ids).not.toContain(notYetStarted!.id);
      expect(ids).not.toContain(expired!.id);
    });
  });
});
