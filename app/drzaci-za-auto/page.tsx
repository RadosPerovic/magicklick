import { ProductPage } from "@/components/magic/product-page";
import { products } from "@/lib/catalog";
export const metadata={title:"Držači za tablice bez rama — MAGic KLICK Auto",description:"Komplet za prednju i zadnju tablicu. Pogledaj fotografije i isprobaj demo kalkulator porudžbine."};
export default function Page(){return <ProductPage key={products[0].id} product={products[0]}/>}
