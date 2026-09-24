"use client";
import Link from "next/link";
import { Mark } from "@/components/armory";
import { useI18n } from "@/components/locale-provider";
export default function NotFound() {
  const { tr } = useI18n();
  return (
    <div className="armory-shell armory-page">
      <div className="empty-panel">
        <Mark name="rune" tone="bone" size={40} />
        <p className="eyebrow">{tr("404 · Lost realm")}</p>
        <h1>{tr("This path is not on the map")}</h1>
        <Link className="forged mt-7" href="/">
          {tr("Return home")}
        </Link>
      </div>
    </div>
  );
}
