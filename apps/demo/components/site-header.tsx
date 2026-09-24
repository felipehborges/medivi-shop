"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Mark, Roman, Rivets } from "./armory";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader() {
  const { copy, t, locale } = useI18n();
  const { cartCount, state } = useDemo();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const links = [
    { href: "/", label: copy.navHome },
    { href: "/catalog", label: copy.navShop },
    { href: "/#departments", label: copy.navDepartments },
  ];
  return (
    <>
      <a className="skip-link" href="#main-content">
        {locale === "pt-BR" ? "Pular para o conteúdo" : "Skip to content"}
      </a>
      <div className="announcement">
        <div className="armory-shell">
          <Mark name="feather" size={13} />
          <span>{copy.banner}</span>
        </div>
      </div>
      <header
        className="site-header"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            menuRef.current?.focus();
          }
        }}
      >
        <div className="armory-shell header-row">
          <Link
            href="/"
            className="wordmark"
            aria-label="Medivi"
            onClick={() => setOpen(false)}
          >
            <Mark name="swords" size={30} />
            <span>
              <span className="wordmark-title">Medivi</span>
              <span className="house-line">{copy.house}</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label={t("menu")}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="header-controls">
            <div className="header-counts">
              <Link
                href="/wishlist"
                onClick={() => setOpen(false)}
                aria-label={`${copy.watchTitle}, ${state.wishlist.length}`}
              >
                <Mark name="feather" tone="bone" size={16} />
                <Roman value={state.wishlist.length} />
              </Link>
              <Link
                href="/cart"
                aria-label={`${t("cart")}, ${cartCount}`}
                onClick={() => setOpen(false)}
              >
                <Mark name="coins" tone="bone" size={17} />
                <Roman value={cartCount} />
              </Link>
            </div>
            <LanguageSwitcher />
            <button
              ref={menuRef}
              className="menu-control"
              aria-label={t("menu")}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen(!open)}
            >
              <span aria-hidden="true">{open ? "×" : "☰"}</span>
            </button>
          </div>
        </div>
        {open && (
          <nav
            className="mobile-nav"
            id="mobile-navigation"
            aria-label={t("menu")}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
export function DemoNotice({ compact = false }: { compact?: boolean }) {
  const { copy } = useI18n();
  if (compact)
    return (
      <p className="demo-line">
        <Mark name="seal" size={20} />
        {copy.demoLine}
      </p>
    );
  return (
    <aside className="parchment notice">
      <Rivets />
      <Mark name="scroll" tone="ink" size={34} />
      <h2>{copy.noticeHead}</h2>
      <p>{copy.noticeText}</p>
      <p className="signature">{copy.noticeSigned}</p>
    </aside>
  );
}
