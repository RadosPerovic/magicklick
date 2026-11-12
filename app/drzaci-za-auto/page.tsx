import { ProductPage } from "@/components/magic/product-page";
import { products } from "@/lib/catalog";
export const metadata={title:"Držači za tablice bez rama — MAGic KLICK Auto",description:"Komplet držača za prednju i zadnju tablicu. Pogledaj fotografije, uputstva za montažu i poruči svoj MAGic KLICK."};
export default function Page(){return <ProductPage key={products[0].id} product={products[0]}/>}
