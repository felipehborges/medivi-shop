"use client";
import Link from "next/link";
import {
  artifactRecords,
  departments,
  products,
  rarityLabels,
} from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { DemoNotice } from "@/components/site-header";
import { Mark, ProductFrame, SectionHeading } from "@/components/armory";
import { useI18n } from "@/components/locale-provider";
import { useDemo } from "@/components/demo-provider";
export default function Home() {
  const { copy, language, formatMoney } = useI18n();
  const { state } = useDemo();
  const ordered = artifactRecords.flatMap((record) => {
    const product = products.find((item) => item.slug === record.slug);
    return product && !state.hiddenProducts.includes(product.slug)
      ? [product]
      : [];
  });
  const hero = ordered[0];
  const heroRecord = artifactRecords.find(
    (record) => record.slug === hero?.slug,
  );
  return (
    <>
      <section className="hero">
        <div className="armory-shell hero-grid">
          <div className="hero-copy">
            <h1>Medivi</h1>
            <div className="hero-house">
              <Mark name="anvil" />
              {copy.house}
            </div>
            <p className="hero-statement">
              {copy.heroLine1}
              <br />
              <em>{copy.heroLine2}</em>
            </p>
            <div className="action-row">
              <Link className="forged" href="/catalog">
                {copy.enterArmory}
              </Link>
              <Link className="text-action" href="/catalog">
                {copy.seeTheWares} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="credentials">
              <span>
                <Mark name="seal" size={16} />
                {copy.guildLine}
              </span>
              <span>{copy.estLine}</span>
              <span>{copy.placeLine}</span>
            </div>
          </div>
          {hero && (
            <div className="hero-frame-wrap">
              <div className="hero-frame-reveal" data-reveal="mask">
                <ProductFrame
                  src={hero.image}
                  alt={heroRecord?.[language].name ?? hero.name}
                  variant="hero"
                  priority
                />
              </div>
              <Link href={`/product/${hero.slug}`} className="price-tag">
                <strong>{heroRecord?.[language].name ?? hero.name}</strong>
                <p>
                  {heroRecord && rarityLabels[language][heroRecord.rar]} ·{" "}
                  {formatMoney(hero.priceCents)}
                </p>
              </Link>
            </div>
          )}
        </div>
      </section>
      <section className="merchant-band">
        <div className="armory-shell merchant-grid">
          {copy.merchantWord.map((word, index) => (
            <article key={word.title}>
              <Mark name={["seal", "anvil", "scroll"][index]!} size={26} />
              <div>
                <h3>{word.title}</h3>
                <p>{word.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section id="departments" className="armory-shell departments">
        <div className="department-heading">
          <div>
            <p className="eyebrow">{copy.departmentsEyebrow}</p>
            <h2>{copy.departmentsHead}</h2>
          </div>
          <p>{copy.departmentsNote}</p>
        </div>
        <div className="department-grid">
          {departments.map((dept) => (
            <Link
              className="department-card"
              href={`/catalog?department=${dept.slug}`}
              key={dept.slug}
              data-reveal="up"
            >
              <Mark name={dept.mark} tone="bone" size={34} />
              <div>
                <h3>{dept[language].name}</h3>
                <p>{dept[language].description}</p>
                <span className="caption">
                  {
                    ordered.filter(
                      (p) =>
                        artifactRecords.find((r) => r.slug === p.slug)?.dept ===
                        dept.slug,
                    ).length
                  }{" "}
                  {copy.wares}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="armory-shell floor-section">
        <SectionHeading>{copy.floorHead}</SectionHeading>
        <div className="wares-grid">
          {ordered.slice(0, 5).map((product) => (
            <ProductCard product={product} key={product.slug} />
          ))}
        </div>
      </section>
      <section className="armory-shell notice-section">
        <DemoNotice />
      </section>
    </>
  );
}
