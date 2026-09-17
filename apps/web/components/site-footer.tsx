import Link from "next/link";
import Image from "next/image";

import { NewsletterForm } from "./newsletter-form";
import { getLocale, getTranslations } from "@/lib/i18n";

export async function SiteFooter() {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Link href="/" className="flex w-fit items-center gap-2" aria-label={t("header.home")}>
            <Image src="/icon.png" alt="" width={40} height={40} />
            <span className="font-display text-lg font-semibold">Medivi Shop</span>
          </Link>
          <p className="text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <Link href="/catalog" className="text-muted-foreground hover:text-foreground">
            {t("footer.catalog")}
          </Link>
          <Link href="/search" className="text-muted-foreground hover:text-foreground">
            {t("footer.search")}
          </Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            {t("footer.privacy")}
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            {t("footer.terms")}
          </Link>
          <Link href="/shipping-returns" className="text-muted-foreground hover:text-foreground">
            {t("footer.shipping")}
          </Link>
        </nav>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("footer.newsletter")}</span>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Medivi Shop. {t("footer.disclaimer")}
      </div>
    </footer>
  );
}
