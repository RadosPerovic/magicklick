import type { MetadataRoute } from "next";
import { imagePath, products } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only indexable, canonical pages. No invented last-modified timestamps.
  return [
    { url: absoluteUrl("/"), images: products.map(product => absoluteUrl(imagePath(product.images[0]))) },
    ...products.map(product => ({
      url: absoluteUrl(`/${product.slug}`),
      images: product.images.map(image => absoluteUrl(imagePath(image))),
    })),
  ];
}
