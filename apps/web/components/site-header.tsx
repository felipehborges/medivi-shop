import Link from "next/link";
import Image from "next/image";

import { Button } from "@medivi/ui/components/ui/button";
import { ThemeToggle } from "@medivi/ui/components/theme-toggle";
import { listCategoryTree } from "@medivi/db/queries";
import { db } from "@medivi/db/client";
import { getSession } from "@/lib/auth-guards";
import { getCurrentCartDetail } from "@/lib/cart";
import { UserMenu } from "./user-menu";
import { CategoryNav } from "./category-nav";
import { SearchBar } from "./search-bar";
import { CartDrawer } from "./cart-drawer";
import { getLocale, getTranslations } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

export async function SiteHeader() {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const [session, categories, cart] = await Promise.all([
    getSession(),
    listCategoryTree(db),
    getCurrentCartDetail(),
  ]);

  return (
    <header className="store-header relative z-20 border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-semibold"
          aria-label={t("header.home")}
        >
          <Image src="/icon.png" alt="" width={34} height={34} priority />
          <span>Medivi Shop</span>
        </Link>

        <div className="hidden flex-1 justify-center px-8 sm:flex">
          <SearchBar />
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} label={t("language.label")} />
          <ThemeToggle />
          <CartDrawer cart={cart} />
          {session ? (
            <UserMenu
              name={session.user.name}
              isAdmin={session.user.role === "admin"}
            />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">{t("header.signIn")}</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">{t("header.signUp")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-2">
        <CategoryNav categories={categories} />
      </div>
    </header>
  );
}
