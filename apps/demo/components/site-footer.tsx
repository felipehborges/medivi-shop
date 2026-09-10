import Link from "next/link";

export function SiteFooter() {
  return <footer className="mt-auto border-t bg-card"><div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-3"><div><div className="font-display text-lg font-bold tracking-widest">MEDIVI</div><p className="mt-2 max-w-xs text-sm text-muted-foreground">A fully interactive fantasy commerce interface built as a safe, backend-free portfolio demonstration.</p></div><div><h2 className="font-semibold">Explore</h2><div className="mt-3 grid gap-2 text-sm text-muted-foreground"><Link href="/catalog">Catalog</Link><Link href="/wishlist">Wishlist</Link><Link href="/admin">Admin demo</Link></div></div><div><h2 className="font-semibold">Demo behavior</h2><p className="mt-3 text-sm text-muted-foreground">Your cart and changes are stored only in local browser storage. Clear them anytime from the admin demo.</p></div></div></footer>;
}
