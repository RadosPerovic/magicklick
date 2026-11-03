import { ProductPage } from "@/components/magic/product-page";
import { products } from "@/lib/catalog";
export const metadata={title:"Držač za motor bez rama — MAGic KLICK Moto",description:"Diskretan držač za tablicu motocikla. Fotografije, informacije i demo forma za poručivanje."};
export default function Page(){return <ProductPage key={products[1].id} product={products[1]}/>}
