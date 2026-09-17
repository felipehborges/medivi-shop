import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@medivi/ui/components/theme-provider";
import { Toaster } from "@medivi/ui/components/ui/sonner";
import { DemoProvider } from "@/components/demo-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LocaleProvider } from "@/components/locale-provider";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"] });

const description = "Explore a fantasy storefront with a browser-only cart, simulated checkout, and interactive admin demo.";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Medivi Shop · Interactive portfolio demo", template: "%s · Medivi Shop" },
  description,
  openGraph: { type: "website", siteName: "Medivi Shop", title: "Medivi Shop · Interactive portfolio demo", description, images: ["/products/dragonbone-greatsword.webp"] },
  twitter: { card: "summary_large_image", title: "Medivi Shop · Interactive portfolio demo", description, images: ["/products/dragonbone-greatsword.webp"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${geist.variable} ${mono.variable} ${cinzel.variable}`}><body className="flex min-h-screen flex-col"><ThemeProvider attribute="class" defaultTheme="dark" enableSystem><LocaleProvider locale="en"><DemoProvider><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /><Toaster /></DemoProvider></LocaleProvider></ThemeProvider></body></html>;
}
