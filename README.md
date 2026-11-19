# MAGic KLICK

Prezentacioni sajt i shop, napravljen u TypeScriptu i Reactu, sa Vinext/Vite okruženjem. Pet stranica: početna, auto držači, moto držači, hooks i zasebna korpa (`/korpa`).

## Lokalni pregled

Node.js 22.13 ili noviji. Iz ovog direktorijuma:

```powershell
npm install
npm run dev
```

Pregled: http://127.0.0.1:5173

Ako Windows npm launcher ne radi, koristi direktno instalirani CLI:

```powershell
node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run dev
```

Provera i produkciona verzija:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-cart.mjs
npm run build
```

## Podešavanje sadržaja

Tehnička SEO podešavanja, ciljne fraze i provera su opisani u [SEO.md](SEO.md). SEO podaci koriste produkcioni domen `https://magic-klick.rs`; izgled i vidljiv sadržaj stranica ostaju isti.

- `lib/catalog.ts`: proizvodi, cene, iznos dostave, prag besplatne dostave i fotografije.
- `lib/orders.ts`: obračun, validacija i transport narudžbine. Cena proizvoda množi se količinom bez količinskog popusta; dodatni hooks par se obračunava jednom uz izabrani proizvod (300 RSD uz auto držač).
- `lib/order-record.server.ts`: obavezna mesečna TXT evidencija van aplikacije, upis pre emailova i redni brojevi po mesecu.
- `components/magic/home.tsx` i `home-sections.tsx`: početna strana.
- `components/magic/product-page.tsx`: prikaz proizvoda, količina i dodavanje u korpu.
- `components/magic/cart-page.tsx`: zasebna korpa, unos podataka, pregled i potvrda porudžbine.
- `lib/cart.ts` i `components/magic/cart-context.tsx`: stavke korpe, zajednički obračun i čuvanje izbora.
- `app/globals.css` i `app/magic-refinements.css`: boje, tipografija, raspored i animacije.

## Poručivanje

U sessionStorage čuvaju se samo proizvodi, količine i izbor dodatnih kukica, kako bi korpa ostala dostupna pri navigaciji i osvežavanju. Podaci kupca ostaju u React stanju stranice korpe do potvrde slanja. Email je obavezno polje. Dostava se u korpi prikazuje tek nakon validnog unosa podataka i obračunava jednom na zbir svih proizvoda. Pregled sadrži fiksni snimak podataka pre potvrde. Pre bilo kog emaila server mora uspešno da upiše porudžbinu u mesečni `.txt` fajl u privatnom `orders` folderu van aplikacije. Uspeh i jedinstveni broj porudžbine prikazuju se kada potom DreamWeb SMTP prihvati interni email. Nema baze porudžbina ni online naplate.

Serverska ruta `/api/orders` šalje dve zasebne HTML/tekstualne poruke: potvrdu kupcu i obaveštenje na adresu iz konfiguracije (početno `orders@magic-klick.rs`). **`private/order-email.json` je podrazumevana serverska konfiguracija u projektu**, automatski učitana i u produkciji. Standardne komande `npm run dev`, `npm run build` i `npm run start` koriste Node profil; `:node` komande su zadržane kao aliasi. Build automatski uključuje konfiguraciju u `dist/standalone/private/order-email.json`. Na Node hosting sa trajnim upisivim diskom prenesi ceo sadržaj `dist/standalone` kao privatni aplikacioni direktorijum van javnog web foldera. Putanja konfiguracije ne mora se postavljati kroz environment variables. Cloudflare/Sites pregled ostaje dostupan preko `dev:preview`, `build:preview` i `start:preview`, sa poručivanjem isključenim. Vercel ne podržava postojeću trajnu TXT evidenciju na lokalnom disku. Bez aktivne konfiguracije kupcu je ponuđeno poručivanje preko Instagrama. Za produkciju i ograničenja zaštite od duplikata pogledaj [EMAIL-SETUP.md](EMAIL-SETUP.md). SMTP autentifikacija izvršava se samo na serveru.

## Izvori fotografija i sadržaja

Originalne fotografije lokalno su sačuvane sa javnog profila https://www.instagram.com/magic.klick/ (pregledan 6. oktobra 2026). Ne zavise od privremenih Instagram CDN linkova. Profil navodi proizvodnju u Srbiji i preuzimanje u Novom Beogradu, Zemunu i Smederevu.

- `19732bf2609aa5d1.jpg`: auto i moto pakovanja.
- `1c2941a8b6af1f88.jpg`: moto držač i pakovanje.
- `aa882e105ac50c86.jpg`: hooks i auto pakovanja.
- `f6a1a55882e760cf.jpg`: detalj tablice bez rama.
- `6954117d5e2414fb.jpg`, `7420fc7753605727.jpg`, `3858937ab5ff7d4f.jpg`, `df6b22664384b3c8.jpg`: fotografije vozila i kompleta.

Raspored je inspirisan Fultala referencom https://htmldemo.net/fultala/fultala/index.html. Implementacija je sopstvena, bez kopiranja plaćenog izvornog koda. Poređenje sa ramom je označena ilustrativna simulacija preko originalne fotografije.

## Provereno

TypeScript provera, produkcioni build, navigacija kroz sve tri kategorije, desktop i mobilni prikaz, učitavanje slika, količina i prateći proizvod, besplatna dostava, preuzimanje i lokacije, validacija prazne forme i obaveznog emaila. Provere transporta koriste isključivo test odgovore, bez slanja emaila. WebMCP kalkulator je proveren validnim unosom i odbijanjem količine 0.
