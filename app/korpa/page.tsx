import { CartPage } from "@/components/magic/cart-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  path: "/korpa",
  title: "Korpa — MAGic KLICK",
  description: "Pregled izabranih MAGic KLICK proizvoda, obračun dostave i unos podataka za poručivanje držača za tablice i kukica za auto sedišta.",
  index: false,
});

export default function Page() { return <CartPage/>; }
