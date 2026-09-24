"use client";
import Link from "next/link";
import { departments } from "@/lib/catalog";
import { Mark } from "./armory";
import { useI18n } from "./locale-provider";
export function SiteFooter() {
  const { copy, language } = useI18n();
  return (
    <footer className="site-footer">
      <div className="armory-shell footer-grid">
        <div>
          <Link href="/" className="wordmark-title">
            Medivi
          </Link>
          <span className="house-line">{copy.house}</span>
          <p>{copy.footerText}</p>
        </div>
        <nav aria-label={copy.footerShop}>
          <div className="eyebrow">{copy.footerShop}</div>
          <div className="footer-links">
            {departments.map((dept) => (
              <Link key={dept.slug} href={`/catalog?department=${dept.slug}`}>
                {dept[language].name}
              </Link>
            ))}
          </div>
        </nav>
        <div>
          <div className="eyebrow">{copy.footerHouse}</div>
          <p>{copy.footerHouseText}</p>
          <div className="guild-line">
            <Mark name="seal" size={26} />
            {copy.guildLine}
          </div>
          <Link href="/admin" className="text-action caption">
            <Mark name="coins" tone="bone" size={15} />
            {copy.adminTitle}
          </Link>
        </div>
      </div>
      <div className="armory-shell footer-credit">
        <a href="/mk/ICONS-LICENSE.txt">
          {language === "pt" ? "Ícones" : "Icons"}: Lorc, Delapouite, Carl
          Olsen, Viscious Speed, Lucas · game-icons.net · CC BY 3.0
        </a>
      </div>
    </footer>
  );
}
