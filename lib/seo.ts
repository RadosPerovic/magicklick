import type { Metadata } from "next";
import { imagePath, type Product, type ProductId } from "./catalog";

// Keep canonical URLs, social previews, structured data and sitemap in sync.
// This is the production domain, including when the site is previewed locally.
export const siteUrl = "https://magic-klick.rs";
export const siteName = "MAGic KLICK";
export const absoluteUrl = (path: string) => new URL(path, `${siteUrl}/`).href;

export const homeSeo = {
  title: "Držači za tablice bez rama za auto i motor | MAGic KLICK",
  description: "MAGic KLICK držači za registarske tablice bez rama za auto i motor i kukice za auto sedišta. Proizvedeno u Srbiji. Pogledaj proizvode i uputstva za montažu.",
};

const productSeo: Record<ProductId, { title: string; description: string }> = {
  auto: {
    title: "Držači za tablice bez rama | MAGic KLICK Auto",
    description: "MAGic KLICK držači za registarske tablice bez rama i okvira. Komplet za prednju i zadnju tablicu automobila, sa šrafovima. Proizvedeno u Srbiji.",
  },
  moto: {
    title: "Držač za tablicu motora bez rama | MAGic KLICK Moto",
    description: "MAGic KLICK držač za registarsku tablicu motora bez rama i okvira. Komplet za jednu tablicu motocikla sa šrafovima. Pogledaj fotografije i video montaže.",
  },
  hooks: {
    title: "Kukice za auto sedišta i torbe | MAGic KLICK Hooks",
    description: "MAGic KLICK Hooks kukice za auto sedišta: par kukica za torbe i kese na naslonu za glavu. Jednostavno postavljanje bez alata i urednija kabina automobila.",
  },
};

interface PageSeo {
  path: string;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  index?: boolean;
}

export function pageMetadata({ path, title, description, image = "/images/pocetna-video-poster.jpg", imageAlt = "MAGic KLICK držači za registarske tablice bez rama", index = true }: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const images = [{ url: absoluteUrl(image), alt: imageAlt }];
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index,
      follow: true,
      ...(index ? { googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } } : {}),
    },
    openGraph: { type: "website", locale: "sr_RS", siteName, title, description, url, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export function productMetadata(product: Product): Metadata {
  return pageMetadata({
    ...productSeo[product.id],
    path: `/${product.slug}`,
    image: imagePath(product.images[0]),
    imageAlt: `${product.name} — ${product.category}`,
  });
}

export function siteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: siteName,
        url: absoluteUrl("/"),
        email: "magicklick.rs@gmail.com",
        telephone: ["+381653613281", "+381648575644"],
        sameAs: ["https://www.instagram.com/magic.klick/", "https://www.tiktok.com/@magic.klick"],
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: siteName,
        url: absoluteUrl("/"),
        inLanguage: "sr-Latn",
        publisher: { "@id": absoluteUrl("/#organization") },
      },
    ],
  };
}

export function homeStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": absoluteUrl("/#webpage"),
    url: absoluteUrl("/"),
    name: homeSeo.title,
    description: homeSeo.description,
    inLanguage: "sr-Latn",
    isPartOf: { "@id": absoluteUrl("/#website") },
    about: { "@id": absoluteUrl("/#organization") },
  };
}

export function productStructuredData(product: Product) {
  const url = absoluteUrl(`/${product.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemPage",
        "@id": `${url}#webpage`,
        url,
        name: productSeo[product.id].title,
        inLanguage: "sr-Latn",
        isPartOf: { "@id": absoluteUrl("/#website") },
        mainEntity: { "@id": `${url}#product` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "Product",
        "@id": `${url}#product`,
        url,
        name: product.name,
        description: product.description,
        category: product.category,
        image: product.images.map(image => absoluteUrl(imagePath(image))),
        brand: { "@type": "Brand", name: siteName },
        color: "Crna",
        offers: {
          "@type": "Offer",
          url,
          price: product.price.toFixed(2),
          priceCurrency: "RSD",
          seller: { "@id": absoluteUrl("/#organization") },
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Početna", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: product.category, item: url },
        ],
      },
    ],
  };
}
