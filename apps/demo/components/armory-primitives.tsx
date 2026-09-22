"use client";

import Image from "next/image";
import { type ReactNode } from "react";
import { mark } from "@/lib/armory";
import { useI18n } from "./locale-provider";
import { armoryText, type ArmoryKey } from "@/lib/armory";

export function useArmory() { const { locale, formatMoney, tr } = useI18n(); return { locale, formatMoney, tr, a: (key: ArmoryKey) => armoryText(locale, key) }; }
export function Mark({ name, tone = "bone", size = 20, className = "" }: { name: string; tone?: "bone" | "bronze" | "ink"; size?: number; className?: string }) { return <Image src={mark(name,tone)} alt="" width={size} height={size} style={{ width:size, height:size, flexShrink:0 }} className={className} />; }
export function ProductFrame({ src, alt, className = "", priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) { return <div className={`arm-frame ${className}`}><Image src={src} alt={alt} fill priority={priority} sizes="(max-width: 900px) 100vw, 50vw" /></div>; }
export function PageHead({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) { return <div className="mb-9"><p className="arm-eyebrow">{eyebrow}</p><h1 className="arm-title mt-3">{title}</h1><div className="arm-rule mt-5" data-reveal="rule" />{sub && <p className="arm-muted mt-4 max-w-[58ch] text-[15px] leading-7">{sub}</p>}</div>; }
export function Parchment({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`arm-parchment ${className}`}>{children}</div>; }
