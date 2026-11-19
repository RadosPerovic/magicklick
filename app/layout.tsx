import type { Metadata } from "next";
import { CartProvider } from "@/components/magic/cart-context";
import { OrderModeProvider } from "@/components/magic/order-mode";
import { StructuredData } from "@/components/magic/structured-data";
import { homeSeo, siteName, siteStructuredData, siteUrl } from "@/lib/seo";
import "./globals.css";
import "./magic-refinements.css";
import "./magic-mobile.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: homeSeo.title,
  description: homeSeo.description,
  icons: {
    icon: "/favicon.svg?v=mk",
    shortcut: "/favicon.svg?v=mk",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr-Latn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;650;700;750;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased"><OrderModeProvider><CartProvider>{children}</CartProvider></OrderModeProvider><StructuredData id="site-schema" data={siteStructuredData()}/></body>
    </html>
  );
}
