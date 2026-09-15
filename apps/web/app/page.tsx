import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@medivi/db/client";
import { getWishlistedProductIds, listActiveBanners, listCategoryTree, listProducts } from "@medivi/db/queries";
import { getSession } from "@/lib/auth-guards";
import { HeroCarousel } from "@/components/hero-carousel";
import { FeaturedCategories } from "@/components/featured-categories";
import { PromoSections } from "@/components/promo-sections";
import { ProductCard } from "@/components/product-card";
import { Button } from "@medivi/ui/components/ui/button";
import { getLocale, getTranslations } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Medivi Shop — Gear for Adventurers",
  description: "Swords, armor, cloaks, relics, and potions for adventurers of every guild.",
};

export default async function Home() {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const [heroBanners, promoBanners, categories, featured, session] = await Promise.all([
    listActiveBanners(db, "hero"),
    listActiveBanners(db, "category"),
    listCategoryTree(db),
    listProducts(db, { sort: "featured", pageSize: 8 }),
    getSession(),
  ]);
  const wishlistedIds = session ? await getWishlistedProductIds(db, session.user.id) : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8">
      <h1 className="font-display text-2xl">{t("home.title")}</h1>

      <HeroCarousel banners={heroBanners} />

      <FeaturedCategories categories={categories} />

      <section aria-labelledby="featured-products-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="featured-products-heading" className="font-display text-2xl">
            {t("home.featured")}
          </h2>
          <Button variant="ghost" asChild>
            <Link href="/catalog">{t("home.browseAll")}</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              showWishlistButton={!!wishlistedIds}
              isWishlisted={wishlistedIds?.has(product.id)}
            />
          ))}
        </div>
      </section>

      <PromoSections banners={promoBanners} />
    </div>
  );
}
