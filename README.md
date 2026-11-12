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
node scripts/run-framework.mjs build
```

## Podešavanje sadržaja

- `lib/catalog.ts`: proizvodi, cene, iznos dostave, prag besplatne dostave i fotografije.
- `lib/orders.ts`: obračun, validacija i transport narudžbine. Cena proizvoda množi se količinom bez količinskog popusta; dodatni hooks par se obračunava jednom uz izabrani proizvod (300 RSD uz auto držač).
- `components/magic/home.tsx` i `home-sections.tsx`: početna strana.
- `components/magic/product-page.tsx`: prikaz proizvoda, količina i dodavanje u korpu.
- `components/magic/cart-page.tsx`: zasebna korpa, unos podataka, pregled i potvrda porudžbine.
- `lib/cart.ts` i `components/magic/cart-context.tsx`: stavke korpe, zajednički obračun i čuvanje izbora.
- `app/globals.css` i `app/magic-refinements.css`: boje, tipografija, raspored i animacije.

## Poručivanje

U sessionStorage čuvaju se samo proizvodi, količine i izbor dodatnih kukica, kako bi korpa ostala dostupna pri navigaciji i osvežavanju. Podaci kupca ostaju u React stanju stranice korpe do potvrde slanja. Email je obavezno polje. Dostava se u korpi prikazuje tek nakon validnog unosa podataka i obračunava jednom na zbir svih proizvoda. Pregled sadrži fiksni snimak podataka pre potvrde. Uspeh i jedinstveni broj porudžbine prikazuju se tek nakon odgovora servera koji potvrđuje da je email servis prihvatio porudžbinu. Nema online naplate.

Slanje porudžbina na `magicklick.rs@gmail.com` pripremljeno je preko serverske rute `/api/orders` i Resenda. Bez aktivne konfiguracije potvrda slanja je onemogućena, a kupcu je ponuđeno poručivanje preko Instagrama. Ne postoji lokalna zamena za uspešnu serversku potvrdu. Za povezivanje servisa i uključivanje pogledaj [EMAIL-SETUP.md](EMAIL-SETUP.md). Tajne i email ključevi ne idu u klijentski kod.

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
