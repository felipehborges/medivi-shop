import { describe, expect, it } from "vitest";
import { withTestTransaction } from "../test";
import { category } from "../schema";
import { listCategoryTree } from "./categories";

let counter = 0;
function slug(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

describe("listCategoryTree", () => {
  it("nests children under their parent and excludes unrelated categories", async () => {
    await withTestTransaction(async (tx) => {
      const [parent] = await tx
        .insert(category)
        .values({ name: "Armor", slug: slug("armor") })
        .returning();
      const [child] = await tx
        .insert(category)
        .values({ name: "Helmets", slug: slug("helmets"), parentId: parent!.id })
        .returning();
      const [standalone] = await tx
        .insert(category)
        .values({ name: "Swords", slug: slug("swords") })
        .returning();

      const tree = await listCategoryTree(tx);
      const ids = tree.map((n) => n.id);

      expect(ids).toContain(parent!.id);
      expect(ids).toContain(standalone!.id);
      expect(ids).not.toContain(child!.id);

      const parentNode = tree.find((n) => n.id === parent!.id);
      expect(parentNode?.children.map((c) => c.id)).toEqual([child!.id]);

      const standaloneNode = tree.find((n) => n.id === standalone!.id);
      expect(standaloneNode?.children).toEqual([]);
    });
  });
});
