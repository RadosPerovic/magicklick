import { ProductPage } from "@/components/magic/product-page";
import { products } from "@/lib/catalog";
import { StructuredData } from "@/components/magic/structured-data";
import { productMetadata, productStructuredData } from "@/lib/seo";

const product = products[0];
export const metadata = productMetadata(product);
export default function Page(){return <><ProductPage key={product.id} product={product}/><StructuredData id="product-schema" data={productStructuredData(product)}/></>}
