# SEO podešavanja

SEO izmene ne menjaju vidljiv sadržaj, naslove u stranici, izgled, fotografije, CSS niti poručivanje. Menjaju se SEO naslovi (i naslov taba pregledača), meta opisi, podaci za deljenje linkova i nevidljivi tehnički podaci.

## Ciljne fraze

| Stranica | Glavne fraze |
| --- | --- |
| `/` | držači za tablice bez rama; držači za registarske tablice za auto i motor |
| `/drzaci-za-auto` | držači za tablice bez rama; nosači registarskih tablica bez okvira |
| `/drzaci-za-motor` | držač za tablicu motora bez rama; držač za tablicu motocikla |
| `/hooks` | kukice za auto sedišta; kukice za torbe i kese; kukice za naslon za glavu |

Ovo su fraze koje metapodaci i postojeći sadržaj pokrivaju, a ne potvrđene pozicije ili istražen obim pretrage.

## Implementacija

- `lib/seo.ts` je centralno mesto za SEO naslove, opise i produkcioni domen `https://magic-klick.rs`. Pri eventualnoj promeni domena uskladiti i postojeće email poruke u `lib/order-messages.server.ts`.
- Svaka od pet stranica ima sopstveni naslov, opis i canonical URL. Open Graph i Twitter metapodaci koriste odgovarajuću postojeću fotografiju; to uređuje prikaz pri deljenju linka.
- `/sitemap.xml` sadrži početnu i tri stranice proizvoda sa njihovim fotografijama. Korpa i API nisu u sitemap-u. Datumi izmene se ne izmišljaju.
- `/robots.txt` dozvoljava javne stranice i resurse, izuzima `/api/` i navodi sitemap. Korpa ostaje dostupna crawleru da bi pročitao `noindex, follow`.
- Server isporučuje JSON-LD tipove `Organization`, `WebSite`, `WebPage`, `ItemPage`, `Product`, `Offer` i `BreadcrumbList`. Nazivi, opisi, fotografije, boja i cene proizvoda koriste postojeći katalog; cena i valuta automatski prate izmene kataloga.
- Nema izmišljenih ocena, recenzija, zaliha, popusta, fizičkih adresa, rokova važenja cena ni uslova povrata. Nisu dodavane skrivene ključne reči.
- Greške 404 zadržavaju status 404 i oznaku `noindex`.

## Provera

Uz pokrenut lokalni sajt:

```powershell
npm run check:seo
```

Za drugi lokalni port ili proveru objavljene verzije:

```powershell
node scripts/check-seo.mjs --url=http://127.0.0.1:5174
node scripts/check-seo.mjs --url=https://magic-klick.rs
```

Provera čita HTML bez izvršavanja JavaScript-a i proverava jedinstvene metapodatke, canonical i social adrese, JSON-LD, podudaranje cena sa prikazom, sitemap, robots.txt, 404 i dostupnost slika. Ne šalje porudžbine niti emailove.

Opcije `--capture-baseline` i `--compare-baseline` služe za poređenje serverskog HTML prikaza pre i posle izmene. Snimak se čuva lokalno u ignorisanom folderu `outputs/`; skripte i metapodaci ne ulaze u poređenje. Poređenje nije zamena za vizuelnu proveru budućih promena dizajna.

## Nakon postavljanja na produkcioni domen

1. Proveriti da javni hosting vraća 200 za početnu, proizvode, sitemap i robots.txt, bez prijave ili hosting `X-Robots-Tag: noindex` zaglavlja. Lokalna provera ne potvrđuje konfiguraciju javnog hostinga.
2. U [Google Search Console](https://search.google.com/search-console) potvrditi vlasništvo nad domenom preko DNS-a i prijaviti `https://magic-klick.rs/sitemap.xml`. Ovo zahteva pristup vlasnika Google nalogu i DNS-u; nije izvršeno promenom koda.
3. Preko URL Inspection proveriti početnu i tri proizvoda i po potrebi zatražiti indeksiranje. Strukturirane podatke proveriti u [Rich Results Test](https://search.google.com/test/rich-results).
4. Na hostingu podesiti trajno preusmerenje HTTP i `www` varijante na `https://magic-klick.rs`, sa očuvanjem putanje i query parametara. Ova promena zavisi od hostinga i nije nametnuta aplikaciji ili lokalnom pregledu.
5. U Search Console pratiti indeksiranje, upite, prikaze i klikove. Metapodaci i strukturirani podaci ne garantuju poziciju niti poseban prikaz rezultata.

Referentne smernice: [canonical adrese](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Product podaci](https://developers.google.com/search/docs/appearance/structured-data/product-snippet), [pravila za strukturirane podatke](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
