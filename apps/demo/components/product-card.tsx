"use client";
import Link from "next/link";
import { type Product } from "@/lib/catalog";
import { goodFor, localizedGood, localizedDept, rarity, roman } from "@/lib/armory";
import { useArmory, ProductFrame, Mark } from "./armory-primitives";
export function ProductCard({ product, compact = false, tall = false }: { product: Product; compact?: boolean; tall?: boolean }) {
  const { a, locale, formatMoney, tr } = useArmory();
  const good = goodFor(product.slug), info = localizedGood(locale,product.slug);
  return <article className="arm-card group relative min-w-0">
    <Link href={`/product/${product.slug}`} className="block">
      <ProductFrame src={product.image} alt={tr(product.name)} className={compact ? "h-[230px]" : tall ? "h-[420px] max-[899px]:h-[300px]" : "h-[300px] max-[899px]:h-[260px]"} />
      {good && <span className="arm-seal absolute right-4 top-4 z-10">{roman(good.rar)}</span>}
      <div className="border-t border-[#e9dfc41a] p-5">
        {!compact && <p className="arm-eyebrow text-[12px]">{good ? rarity(locale,good.rar) : tr(product.material)}{good ? ` · ${localizedDept(locale,good.dept)?.name}` : ""}</p>}
        <h3 className="arm-ui mt-1 text-[27px] font-medium leading-tight text-[#efe6cc]">{tr(product.name)}</h3>
        {!compact && <><p className="mt-2 min-h-12 text-[14px] leading-6 text-[#b7a67d]">{info?.description ?? tr(product.description)}</p><div className="arm-ui mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#9a8b6a]"><span className="flex items-center gap-1"><Mark name="anvil" size={16}/>{tr(product.material)}</span>{info?.origin && <span>{info.origin}</span>}{info?.era && <span>{info.era}</span>}</div><div className="arm-rule mt-5" /></>}
        <div className="arm-ui mt-4 flex flex-wrap items-end justify-between gap-2"><span className="text-[26px] text-[#efe6cc]">{formatMoney(product.priceCents)}</span><span className="arm-link text-[15px]">{a("viewArtifact")} →</span></div>
      </div>
    </Link>
  </article>;
}
