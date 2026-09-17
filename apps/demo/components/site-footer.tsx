"use client";

import Link from "next/link";
import Image from "next/image";
import { useI18n } from "./locale-provider";

export function SiteFooter() {
  const { t, tr } = useI18n();
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-3">
        <div>
          <Link href="/" className="flex w-fit items-center gap-2" aria-label={tr("Medivi home")}>
            <Image src="/icon.png" alt="" width={42} height={42} />
            <span className="font-display text-lg font-bold tracking-widest">MEDIVI</span>
          </Link>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">{t("footerText")}</p>
        </div>
        <div>
          <h2 className="font-semibold">{t("explore")}</h2>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link href="/catalog">{t("catalog")}</Link>
            <Link href="/wishlist">{t("wishlist")}</Link>
            <Link href="/admin">{t("admin")}</Link>
          </div>
        </div>
        <div>
          <h2 className="font-semibold">{t("demoBehavior")}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t("demoBehaviorText")}</p>
        </div>
      </div>
    </footer>
  );
}
