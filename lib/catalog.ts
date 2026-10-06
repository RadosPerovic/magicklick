export type ProductId = "auto" | "moto" | "hooks";
export interface Product { id: ProductId; slug: string; name: string; category: string; headline: string; description: string; price: number; unit: string; images: string[]; includes: string[]; }
export const products: Product[] = [
 {id:"auto",slug:"drzaci-za-auto",name:"Magic Klick Auto",category:"Držači za auto",headline:"Tablica u prvom planu.",description:"Pusti linije svog automobila da govore. Diskretni držači za prednju i zadnju tablicu, bez plastičnog rama i suvišnih reklama.",price:1800,unit:"komplet",images:["19732bf2609aa5d1","f6a1a55882e760cf","6954117d5e2414fb","df6b22664384b3c8"],includes:["Komplet za prednju i zadnju tablicu","Crni držači diskretnog profila","Kratko uputstvo za montažu"]},
 {id:"moto",slug:"drzaci-za-motor",name:"Magic Klick Moto",category:"Držači za motor",headline:"Sloboda. Bez okvira.",description:"Mali detalj za velike vožnje. Držač za tablicu motocikla koji prati čist izgled tvog motora, bez dodatnog rama.",price:1200,unit:"komad",images:["1c2941a8b6af1f88","19732bf2609aa5d1"],includes:["Jedan držač za tablicu motocikla","Crna završna obrada","Kratko uputstvo za montažu"]},
 {id:"hooks",slug:"hooks",name:"Magic Klick Hooks",category:"Hooks za sedišta",headline:"Sve na svom mestu.",description:"Kese, torba i sitnice imaju svoje mesto. Praktične kukice za naslon za glavu vozačevog i suvozačevog sedišta.",price:650,unit:"par",images:["aa882e105ac50c86"],includes:["Par kukica za naslon za glavu","Za vozačevo i suvozačevo sedište","Jednostavno postavljanje"]}
];
export const formatPrice = (n: number) => new Intl.NumberFormat("sr-RS").format(n) + " RSD";
export const imagePath = (id: string) => `/images/${id}.jpg`;
export const shipping = { courier: 400, freeFrom: 4000 };
