import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@medivi/ui/components/theme-provider";
import { Toaster } from "@medivi/ui/components/ui/sonner";
import { DemoProvider } from "@/components/demo-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LocaleProvider } from "@/components/locale-provider";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"] });

export const metadata: Metadata = { title: { default: "Medivi Shop Demo", template: "%s · Medivi" }, description: "An interactive, backend-free fantasy storefront demonstration." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${geist.variable} ${mono.variable} ${cinzel.variable}`}><body className="flex min-h-screen flex-col"><ThemeProvider attribute="class" defaultTheme="dark" enableSystem><LocaleProvider locale="en"><DemoProvider><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /><Toaster /></DemoProvider></LocaleProvider></ThemeProvider></body></html>;
}
