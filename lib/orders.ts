import { products, shipping, type ProductId } from "./catalog";
export interface OrderConfig { productId: ProductId; quantity: number; hooks: boolean; delivery: "courier" | "pickup"; pickupLocation: string; }
export interface Customer { name: string; phone: string; email: string; city: string; postalCode: string; address: string; note: string; }
export interface Quote { productTotal: number; extras: number; discount: number; subtotal: number; delivery: number; total: number; }
export function calculateQuote(config: OrderConfig): Quote {
 const product = products.find(p=>p.id===config.productId);
 if (!product || !Number.isInteger(config.quantity) || config.quantity<1 || config.quantity>20 || !["courier","pickup"].includes(config.delivery)) throw new Error("Neispravna konfiguracija porudžbine.");
 const productTotal = product.price * config.quantity;
 const extras = config.hooks && config.productId!=="hooks" ? products.find(p=>p.id==="hooks")!.price : 0;
 const discount = config.quantity>=3 ? Math.round(productTotal*.1) : 0;
 const subtotal = productTotal + extras - discount;
 const delivery = config.delivery==="pickup" || subtotal>=shipping.freeFrom ? 0 : shipping.courier;
 return {productTotal,extras,discount,subtotal,delivery,total:subtotal+delivery};
}
export function validateCustomer(customer: Customer, delivery: OrderConfig["delivery"]) {
 const errors: Partial<Record<keyof Customer | "consent", string>> = {};
 if(customer.name.trim().length<3)errors.name="Unesi ime i prezime (najmanje 3 znaka).";
 const digits=customer.phone.replace(/\D/g,"");
 if(!/^\+?[\d\s()-]+$/.test(customer.phone.trim()) || digits.length<7 || digits.length>15)errors.phone="Unesi ispravan broj telefona, npr. 064 123 4567.";
 if(customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))errors.email="Proveri email adresu ili ostavi polje prazno.";
 if(delivery==="courier"){
  if(customer.city.trim().length<2)errors.city="Unesi mesto za dostavu.";
  if(!/^\d{5}$/.test(customer.postalCode.trim()))errors.postalCode="Unesi petocifreni poštanski broj.";
  if(customer.address.trim().length<4)errors.address="Unesi ulicu i kućni broj.";
 }
 return errors;
}
export interface OrderPayload { config: OrderConfig; customer: Customer; quote: Quote; }
export interface OrderReceipt { id: string; createdAt: string; mode: "demo"; total: number; }
// Replace this transport with your own backend adapter when real orders are enabled.
// The demo adapter makes no network requests, sends no email and stores no customer data.
export type OrderTransport = (payload: OrderPayload) => Promise<OrderReceipt>;
export const submitDemoOrder: OrderTransport = async (payload) => {
 if(Object.keys(validateCustomer(payload.customer,payload.config.delivery)).length)throw new Error("Proveri podatke za porudžbinu.");
 const quote=calculateQuote(payload.config);
 await new Promise(resolve=>setTimeout(resolve,700));
 return {id:`MK-DEMO-${crypto.randomUUID().slice(0,8).toUpperCase()}`,createdAt:new Date().toISOString(),mode:"demo",total:quote.total};
};
