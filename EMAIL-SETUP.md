# Slanje porudžbina emailom

Pripremljeno za Resend. Primalac je fiksno podešen na **magicklick.rs@gmail.com** u serverskom kodu. Kupac vidi pregled i potvrdu porudžbine; ne vidi interni email niti podatke za pristup servisu.

## Aktiviranje kada servis bude dostupan

1. Otvori Resend nalog i potvrdi adresu/domen pošiljaoca prema [Resend uputstvu](https://resend.com/docs/dashboard/domains/introduction).
2. Napravi API ključ sa dozvolom za slanje sa tog domena.
3. Za lokalni sajt kopiraj `.env.example` u `.dev.vars` u ovom direktorijumu i popuni `RESEND_API_KEY` i `ORDER_EMAIL_FROM` (npr. `MAGic KLICK <porudzbine@tvoj-domen.rs>`). Za objavljeni Sites sajt iste vrednosti postavi kao serverske environment variables/secrets preko Sites podešavanja. Ne unosi API ključ u chat, klijentski kod ili hosting.json.
4. Postavi `ORDERS_ENABLED=true` i restartuj lokalni server; za objavljeni sajt proveri da je verzija sa ovom integracijom aktivna. Osveži stranicu.
5. Napravi jednu test porudžbinu i proveri prijem emaila, uključujući Spam folder.

Gmail adresa prima email; ona ne mora biti adresa pošiljaoca. Za proizvoljno slanje preko Resenda koristi potvrđen domen pošiljaoca. Test domen `resend.dev` ima ograničenja primaoca; proveri ih u svom Resend nalogu. Za rad ovog sajta ne treba Gmail lozinka.

Dok nedostaje ključ/adresa ili `ORDERS_ENABLED` nije `true`, kupac može da pregleda korpu i podatke, ali je potvrda slanja onemogućena. U pregledu je ponuđeno poručivanje preko Instagrama. Ako je slanje uključeno, ali servis prijavi grešku, kupac dobija poruku o neuspehu i korpa ostaje sačuvana. Uspešna potvrda se prikazuje tek kada servis prihvati email; to samo po sebi nije potvrda da je email stigao u Inbox.

## Šta stiže u email

Broj porudžbine, proizvodi, količine, dodatne kukice, zbir proizvoda, poštarina, ukupan iznos, ime, telefon, obavezni email, način dostave, odgovarajući podaci za isporuku i napomena. Cene i poštarina se ponovo računaju na serveru. Kupcu se ne šalje automatski email.

Isti pokušaj slanja koristi stabilan Resend idempotency ključ, kako ponovni klik nakon mrežne greške ne bi napravio dupli email u okviru Resendovog perioda od 24 sata. Ako se vraćaš na izmenu podataka i ponovo potvrđuješ pregled, to je nov pokušaj porudžbine.

Nema online naplate, baze porudžbina ni garantovanog reda za dostavljanje emaila. Server ograničava broj pokušaja po IP adresi u okviru jedne worker instance; za javni sajt sa većim saobraćajem koristi i ograničenja na hosting platformi. Pre stvarnog početka prodaje proveri cenovnik, dostavu i uslove prodaje.

## Provere bez slanja emaila

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-cart.mjs
node scripts/check-order-email.mjs
```

Test email transport je simuliran; poslednja provera ne šalje ništa i ne zahteva API ključ. Stvarni prijem emaila može se proveriti tek nakon povezivanja servisa.

Dokumentacija: [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [idempotency ključevi](https://resend.com/docs/dashboard/emails/idempotency-keys), [Cloudflare lokalne tajne](https://developers.cloudflare.com/workers/vite-plugin/reference/secrets/).
