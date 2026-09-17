const fallbackUrl = "https://medivi-shop.vercel.app";

// Static metadata and sitemap are generated at build time. Set this to the
// production domain when deploying under a custom URL.
export const siteUrl = (process.env.NEXT_PUBLIC_DEMO_URL || fallbackUrl).replace(/\/+$/, "");
