import { ProductPage } from "@/components/magic/product-page";
import { products } from "@/lib/catalog";
export const metadata={title:"Hooks kukice za sedišta — Magic Klick",description:"Praktične kukice za kese i stvari na naslonu za glavu. Isprobaj kalkulator i demo porudžbinu."};
export default function Page(){return <ProductPage key={products[2].id} product={products[2]}/>}
