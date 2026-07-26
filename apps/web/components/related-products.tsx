import type { ProductListItem } from "@medivi/db/queries";
import { ProductCard } from "./product-card";

export function RelatedProducts({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="mb-4 font-display text-xl">You might also like</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
