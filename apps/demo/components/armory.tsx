import Image from "next/image";
import type { ReactNode } from "react";

export function Mark({
  name,
  tone = "bronze",
  size = 20,
}: {
  name: string;
  tone?: "bone" | "bronze" | "ink";
  size?: number;
}) {
  return (
    <Image
      className="armory-mark"
      src={`/mk/${name}-${tone}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
export function Roman({ value }: { value: number }) {
  let left = Math.max(0, Math.floor(value));
  let result = "";
  for (const [number, letter] of [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ] as const) {
    while (left >= number) {
      result += letter;
      left -= number;
    }
  }
  return <span aria-hidden="true">{result || "—"}</span>;
}
export function Rivets() {
  return (
    <span className="rivets" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
export function ProductFrame({
  src,
  alt,
  variant = "card",
  children,
  priority = false,
}: {
  src: string;
  alt: string;
  variant?: "card" | "hero" | "detail" | "small";
  children?: ReactNode;
  priority?: boolean;
}) {
  return (
    <div className={`product-frame product-frame--${variant}`}>
      <div className="product-photo">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={
            variant === "small"
              ? "70px"
              : "(min-width:1200px) 580px, (min-width:900px) 50vw, 100vw"
          }
        />
      </div>
      {variant === "hero" || variant === "detail" ? <Rivets /> : null}
      {children}
    </div>
  );
}
export function Heading({
  title,
  subtitle,
  eyebrow,
  mark,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  mark?: string;
}) {
  return (
    <div className="page-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div className="heading-rule">
        {mark && <Mark name={mark} size={28} />}
        <h1>{title}</h1>
        <span className="rule" />
      </div>
      {subtitle && <p className="lede">{subtitle}</p>}
    </div>
  );
}
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="heading-rule">
      <h2>{children}</h2>
      <span className="rule" data-reveal="rule" />
      <Mark name="knot" size={22} />
    </div>
  );
}
