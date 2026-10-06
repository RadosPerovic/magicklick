import type { Metadata } from "next";
import "./globals.css";
import "./magic-refinements.css";

export const metadata: Metadata = {
  title: "Magic Klick — Mali detalj. Velika razlika.",
  description: "Držači za tablice bez rama, držači za motor i hooks za sedišta. Proizvedeno u Srbiji. Otkrij svoj Magic Klick.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
