import { products, shipping, autoHooksPromoPrice, type ProductId } from "./catalog";
export interface OrderConfig { productId: ProductId; quantity: number; hooks: boolean; delivery: "courier" | "post-office" | "pickup"; pickupLocation: string; }
export interface Customer { name: string; phone: string; email: string; city: string; postalCode: string; address: string; note: string; }
export interface Quote { productTotal: number; extras: number; subtotal: number; delivery: number; total: number; }
export function calculateQuote(config: OrderConfig): Quote {
 const product = products.find(p=>p.id===config.productId);
 if (!product || !Number.isInteger(config.quantity) || config.quantity<1 || config.quantity>20 || !["courier","post-office","pickup"].includes(config.delivery)) throw new Error("Neispravna konfiguracija porudžbine.");
 const productTotal = product.price * config.quantity;
 const extras = config.hooks && config.productId==="auto" ? autoHooksPromoPrice : 0;
 const subtotal = productTotal + extras;
 const delivery = config.delivery==="pickup" || subtotal>=shipping.freeFrom ? 0 : config.delivery==="post-office" ? shipping.postOffice : shipping.courier;
 return {productTotal,extras,subtotal,delivery,total:subtotal+delivery};
}
export function validateCustomer(customer: Customer, delivery: OrderConfig["delivery"]) {
 const errors: Partial<Record<keyof Customer | "consent", string>> = {};
 if(customer.name.trim().length<3)errors.name="Unesi ime i prezime (najmanje 3 znaka).";
 const digits=customer.phone.replace(/\D/g,"");
 if(!/^\+?[\d\s()-]+$/.test(customer.phone.trim()) || digits.length<7 || digits.length>15)errors.phone="Unesi ispravan broj telefona, npr. 064 123 4567.";
 if(!customer.email.trim())errors.email="Unesi email adresu.";
 else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))errors.email="Unesi ispravnu email adresu.";
 if(delivery==="courier" || delivery==="post-office"){
  if(!/^\d{5}$/.test(customer.postalCode.trim()))errors.postalCode="Unesi petocifreni poštanski broj.";
 }
 if(delivery==="courier"){
  if(customer.city.trim().length<2)errors.city="Unesi mesto za dostavu.";
  if(customer.address.trim().length<4)errors.address="Unesi ulicu i kućni broj.";
 }
 return errors;
}
export interface OrderReceipt { id: string; createdAt: string; mode: "live"; total: number; }
