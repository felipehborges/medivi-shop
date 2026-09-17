import { Suspense } from "react";
import { ConfirmationView } from "@/components/confirmation-view";
import { LoadingCopy } from "@/components/loading-copy";
export const metadata = { title: "Demo order confirmed" };
export default function ConfirmationPage() { return <Suspense fallback={<LoadingCopy text="Loading demo order…" className="p-12 text-center" />}><ConfirmationView/></Suspense>; }
