import { ProductPage } from "@/components/magic/product-page";
import { products } from "@/lib/catalog";
export const metadata={title:"Hooks kukice za sedišta — MAGic KLICK",description:"Praktične kukice za kese i stvari na naslonu za glavu. Pogledaj MAGic KLICK Hooks i dodaj ih u korpu."};
export default function Page(){return <ProductPage key={products[2].id} product={products[2]}/>}
