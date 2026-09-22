import type { Metadata } from "next";
import { Grenze, Grenze_Gotisch, Gentium_Book_Plus } from "next/font/google";
import { ThemeProvider } from "@medivi/ui/components/theme-provider";
import { Toaster } from "@medivi/ui/components/ui/sonner";
import { DemoProvider } from "@/components/demo-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LocaleProvider } from "@/components/locale-provider";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const grenze = Grenze({ variable: "--font-armory-ui", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const gothic = Grenze_Gotisch({ variable: "--font-armory-display", subsets: ["latin"], weight: ["400", "500", "600"] });
const gentium = Gentium_Book_Plus({ variable: "--font-armory-body", subsets: ["latin"], weight: ["400", "700"] });

const description = "Explore a fantasy storefront with a browser-only cart, simulated checkout, and interactive admin demo.";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Medivi Shop · Interactive portfolio demo", template: "%s · Medivi Shop" },
  description,
  openGraph: { type: "website", siteName: "Medivi Shop", title: "Medivi Shop · Interactive portfolio demo", description, images: ["/products/dragonbone-greatsword-natural.webp"] },
  twitter: { card: "summary_large_image", title: "Medivi Shop · Interactive portfolio demo", description, images: ["/products/dragonbone-greatsword-natural.webp"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${grenze.variable} ${gothic.variable} ${gentium.variable}`}><body className="flex min-h-screen flex-col"><ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark"><LocaleProvider locale="en"><DemoProvider><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /><Toaster /></DemoProvider></LocaleProvider></ThemeProvider></body></html>;
}
