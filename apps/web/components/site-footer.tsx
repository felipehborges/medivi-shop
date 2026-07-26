import Link from "next/link";

import { NewsletterForm } from "./newsletter-form";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="font-display text-lg font-semibold">Medivi Shop</span>
          <p className="text-sm text-muted-foreground">Gear for adventurers of every guild.</p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <Link href="/catalog" className="text-muted-foreground hover:text-foreground">
            Catalog
          </Link>
          <Link href="/search" className="text-muted-foreground hover:text-foreground">
            Search
          </Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/shipping-returns" className="text-muted-foreground hover:text-foreground">
            Shipping &amp; Returns
          </Link>
        </nav>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Join the guild newsletter</span>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Medivi Shop. A fictional store — portfolio project only.
      </div>
    </footer>
  );
}
