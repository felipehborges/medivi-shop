import { Suspense } from "react";
import { ConfirmationView } from "@/components/confirmation-view";
export const metadata = { title: "Demo order confirmed" };
export default function ConfirmationPage() { return <Suspense fallback={<div className="p-12 text-center">Loading demo order…</div>}><ConfirmationView/></Suspense>; }
