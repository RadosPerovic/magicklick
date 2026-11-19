# Porudžbine preko DreamWeb SMTP-a

Porudžbine se **ne čuvaju u bazi**. Pre slanja oba emaila server mora uspešno da upiše porudžbinu u mesečnu TXT evidenciju van aplikacije i potvrdi upis na disk (`fsync`). Ako upis ne uspe, nijedan email se ne pokušava i kupac dobija grešku. Server vraća uspeh tek kada posle upisa SMTP prihvati poruku za našu adresu. Greška potvrde kupcu ne poništava uspešno poslati interni email. Ako interni email ne uspe, TXT red ostaje sačuvan, server vraća grešku i kupac može ponoviti pokušaj sa istim brojem.

SMTP prihvatanje nije garancija da je poruka stigla u Inbox. Pratiti odbijene poruke i Spam folder naloga pošiljaoca. Korisno je dodati filter/arhiviranje za interne potvrde.

## Mesečna evidencija porudžbina

Folder `orders` i mesečni fajl, npr. `2026-11.txt`, kreiraju se automatski pri prvoj porudžbini. Podrazumevana lokacija je **pored aplikacionog radnog direktorijuma**, van njega. Za lokalni projekat to je `C:\Projects\MagicKlickTestSajt\orders`; za aplikaciju u `/home/CPANEL_USER/magic-klick` to je `/home/CPANEL_USER/orders`.

Ne moraš unositi putanju niti postavljati `MAGIC_KLICK_ORDERS_DIRECTORY`: podrazumevano se koristi **`../orders`**, u odnosu na radni direktorijum aplikacije. To je isto podešavanje i lokalno i na hostingu. Za aplikaciju u `magic-klick` fajl za novembar se upisuje u `../orders/2026-11.txt`.

Ako želiš eksplicitno relativno podešavanje, opciona serverska promenljiva može biti:

```text
MAGIC_KLICK_ORDERS_DIRECTORY=../orders
```

Apsolutna putanja poput `/home/CPANEL_USER/orders` i dalje je podržana ako ti zatreba. U oba slučaja odredište mora ostati van aplikacije i javnog document root-a. `./orders` označava folder unutar aplikacije i zato se odbija. Aplikaciju lokalno pokreći iz njenog osnovnog direktorijuma; u cPanel-u to je podešeni Application root. Relativna putanja je serverska putanja na disku, a ne ruta sajta. Roditeljski direktorijum mora dozvoljavati pisanje Node procesu. Putanje kroz simboličke linkove se proveravaju; lokacije u `public_html`, `public`, `www`, `htdocs`, `dist` i `.next` se odbijaju. Na Linuxu se novi folder kreira sa dozvolama `700`, a fajlovi sa `600`. Ne postavljaj statičku rutu za ovaj folder. Uključi ga u serverski backup; ne ide u Git ili build.

Svaka porudžbina je jedan UTF-8 red, sa atributima odvojenim zarezima. Između dve porudžbine dodaje se jedan prazan red radi čitljivosti. Prazni redovi ne utiču na mesečnu numeraciju. Primer:

```text
#1,OrderId="MK-15E4A11B-ADAA-4FA1-8CE7-B070F66C53B1",ImePrezime="Marko Petrović",Telefon="0641234567",Adresa="Primer ulica 12, 11000 Beograd",EmailAdresa="marko@example.com",VremePorudzbine="2026-11-19T20:15:12.123+01:00",KontrolniZbir="…"

#2,OrderId="MK-42FE7B42-48F0-4D47-A8D2-755B8B3A068D",ImePrezime="Ana Petrović",Telefon="0651234567",Adresa="Druga ulica 3, 21000 Novi Sad",EmailAdresa="ana@example.com",VremePorudzbine="2026-11-19T20:20:00.000+01:00",KontrolniZbir="…"
```

- `OrderId` koristi postojeći oblik **`MK-<UUID>`**, npr. iz primera. UUID se generiše za pokušaj porudžbine; isti ID se koristi u evidenciji, potvrdi na sajtu i oba emaila. Ne zahteva centralni brojač i ne otkriva podatke kupca.
- `#1`, `#2` itd. predstavljaju redni broj u tom mesečnom fajlu. Novi mesec počinje od `#1`. Mesec i vreme određuju se u zoni `Europe/Belgrade`, uključujući letnje računanje vremena.
- Polje „Ime i prezime“ beleži se zajedno kao `ImePrezime`, sa istim sadržajem kao u validiranom unosu. Ime i prezime se ne razdvajaju.
- `Telefon` se preuzima iz porudžbine i čuva kao tekst, uključujući početnu nulu, pozivni broj i dozvoljeno formatiranje.
- Za dostavu na adresu beleže se ulica, broj, poštanski broj i mesto. Za preuzimanje u pošti beleži se pošta sa poštanskim brojem.
- Vrednosti su pod navodnicima, pa zarez u adresi ili imenu ostaje deo vrednosti. Navodnici i kontrolni znakovi u podacima zapisuju se kao JSON escape sekvence: nalepljeni novi redovi i tabovi ne mogu napraviti lažnu dodatnu porudžbinu. Nova porudžbina uvek počinje u novom zasebnom redu.
- Dodatna kolona `KontrolniZbir` sadrži SHA-256 otisak podataka porudžbine, bez lozinki. Služi da isti ID sa promenjenim podacima bude odbijen i nakon restarta. Ponovljen zahtev sa istim ID-jem i istim sadržajem ne dobija novi red niti nov redni broj; vraća se prvobitno vreme porudžbine. Proveravaju se i prethodni meseci.

Stariji redovi sa tabovima i odvojenim `Ime`/`Prezime`, kao i zapisi sa zarezima bez kolone `Telefon`, ostaju podržani pri čitanju. Novi redovi koriste zareze, zajedničko `ImePrezime` i `Telefon`, uz prazan red između porudžbina i nastavak mesečne numeracije. Prethodni zapisi se ne dopunjuju telefonom koji u njima nije sačuvan.

Upisi iz više Node procesa na istom hostingu koriste zajednički ekskluzivni fajl `.orders.lock`, tako da se brojevi i redovi ne preklapaju. Svi procesi moraju koristiti isti privatni folder na istom fajl-sistemu. Ako je evidencija zauzeta duže od 5 sekundi, zahtev ne šalje email i može se ponoviti. Ne menjaj ručno redove ili redne brojeve: neispravan završen red zaustavlja dalje upise. Nepotpun poslednji red od prekinutog upisa oporavlja se pre narednog upisa.

Posle nasilnog gašenja procesa može ostati `.orders.lock`. Aplikacija ga namerno ne uklanja dok postoji mogućnost da neki proces još piše. Za oporavak zaustavi sve Node procese te aplikacije, ukloni samo taj zaključavajući fajl iz `orders` foldera i ponovo pokreni aplikaciju. Mesečne `.txt` fajlove zadrži.

## Privatna konfiguracija

Verzionisan primer bez tajni: `config/order-email.example.json`. Po zahtevu vlasnika projekta, i `private/order-email.json` je uključen u Git verzionisanje, sa `enabled: true` i početno praznom lozinkom. Lozinka koja se naknadno unese u ovaj fajl može ući u Git istoriju. Menjaju se sledeća polja:

| Polje | Početna vrednost / značenje |
| --- | --- |
| `enabled` | `true` u `private/order-email.json`; primer ostaje `false` |
| `host` | `host133.dwhost.net`; prema dostavljenom prikazu DreamWeb cPanel → Email Accounts → Connect Devices |
| `port` | `465` |
| `encryption` | `implicit-tls`; druga dozvoljena opcija je `starttls` (tipično port 587, prema cPanel-u) |
| `username` | `info@magic-klick.rs` |
| `password` | Prazno; ručno unesi lozinku ovog SMTP naloga |
| `fromEmail` | `info@magic-klick.rs` |
| `fromName` | `Magic Klick` |
| `ordersEmail` | `orders@magic-klick.rs`; napravi/proveri ovo sanduče |

Email kupca se uvek uzima iz konkretne validirane porudžbine. Ne dodaje se u konfiguraciju.

DreamWeb [uputstvo za email klijent](https://helpdesk.dreamweb.rs/sr/baza-znanja/article/podesavanje-klijentske-email-aplikacije) navodi SMTP 465 uz SSL/TLS. Host `host133.dwhost.net`, port 465 i korisničko ime uneti su prema dostavljenoj slici cPanel podešavanja. Za STARTTLS server mora podržavati obavezno podizanje TLS veze. U oba režima proveravaju se sertifikat i naziv servera, uz najmanje TLS 1.2; provera se ne može isključiti kroz JSON. Podešavanja prate [Nodemailer SMTP dokumentaciju](https://nodemailer.com/smtp).

## Lokalno pokretanje Node profila

Node.js 22.13+ i instalirane zavisnosti:

```powershell
New-Item -ItemType Directory -Force private
Copy-Item config/order-email.example.json private/order-email.json
$env:MAGIC_KLICK_EMAIL_CONFIG = 'C:\Projects\MagicKlickTestSajt\magic-klick\private\order-email.json'
npm run dev:node
```

Ako direktorijum `private` ne postoji, prvo ga napravi. Ne prepisuj već popunjenu kopiju. Konfiguracija sa `enabled: false` ne šalje emailove. Lozinka sa praznom vrednošću ne dozvoljava uključivanje slanja.

## Produkcija na Node.js hostingu

1. Potreban je hosting paket sa podrškom za Node.js 22.13 ili noviji i izlaznom SMTP konekcijom ka DreamWeb serveru. Proveri dostupnost opcije **Setup Node.js App** i odgovarajuće verzije u konkretnom cPanel nalogu. DreamWeb podržava Node.js samo na određenim paketima; javno uputstvo ne potvrđuje verzije dostupne na tvom nalogu. Postojeći Cloudflare/Sites build (`npm run build` / `npm run start`) ne koristi ovaj SMTP modul i prikazuje poručivanje kao isključeno. Statički hosting sam ne može slati ove poruke.
2. Kopiraj primer na server, **van Git repozitorijuma, aplikacionog direktorijuma i javnog document root-a**, npr. `/home/CPANEL_USER/magic-klick-private/order-email.json`. Nemoj ga stavljati u `public_html`, `public`, `www`, `htdocs`, `dist` ili `.next`.
3. Ručno popuni lozinku, potvrdi host/port/enkripciju u cPanel-u, proveri pošiljaoca i prijemno sanduče. U JSON-u koristi validne JSON escape sekvence ako lozinka sadrži navodnike ili obrnutu kosu crtu. Ograniči pristup fajlu na vlasnika procesa (`chmod 600`, privatni direktorijum `chmod 700`). Projektni fajl `private/order-email.json` izuzet je iz Git ignorisanja po zahtevu vlasnika; ostali privatni fajlovi ostaju ignorisani.
4. U serverskim environment variables postavi `MAGIC_KLICK_EMAIL_CONFIG=/home/CPANEL_USER/magic-klick-private/order-email.json`. Putanja SMTP konfiguracije ostaje apsolutna; to nije sadržaj konfiguracije. Za evidenciju ne moraš postavljati `MAGIC_KLICK_ORDERS_DIRECTORY`: koristi se `../orders`. Ako je već postavljena stara apsolutna vrednost, ukloni je ili zameni sa `../orders`. Ne koristi `NEXT_PUBLIC_*` ili `VITE_*` promenljive za tajne.
5. Instaliraj zavisnosti i napravi Node build (`npm ci`, `npm run build:node`), lokalno ili u podržanom Node okruženju. **Na DreamWeb deljenom hostingu aplikaciju pokreći i restartuj kroz cPanel → Setup Node.js App**, prema [njihovom uputstvu](https://helpdesk.dreamweb.rs/sr/baza-znanja/article/pokretanje-node-js-aplikacije); ono izričito ne podržava pokretanje preko `start` skripte iz `package.json`. Postavi Production režim i aplikacioni direktorijum van `public_html`. Build generiše `dist/standalone/server.js` i potrebne runtime zavisnosti, ali kompatibilnost tog ESM startup fajla sa konkretnom cPanel/Passenger instalacijom mora se proveriti pri postavljanju; može biti potreban prilagođen startup adapter. `npm run start:node` ostaje komanda za standardno samostalno Node okruženje, a nije potvrđen DreamWeb postupak. Proxy mora prepisivati IP zaglavlja, uz sopstveno ograničenje broja zahteva.
6. Kada si spreman za stvarno slanje, postavi `enabled: true` i restartuj Node aplikaciju. Konfiguracija se čita sa diska na prvom zahtevu; uspešno učitani servis se koristi do restarta. U produkciji se odbija konfiguracioni fajl unutar aplikacije, uključujući putanje kroz simboličke linkove. Posle izmene konfiguracije uvek restartuj proces.
7. Prvo testiraj sopstvenom adresom kupca i proveri obe poruke. Automatske provere opisane ispod ne otvaraju SMTP veze i ne šalju stvarne poruke.

Za `orders` nije potrebna administratorska/root dozvola: Node proces mora imati pravo kreiranja fajlova i pisanja u tom folderu, odnosno u roditeljskom folderu ako `orders` još ne postoji. Ako su Node proces i folder pod istim cPanel korisnikom, dozvole `700` za folder i `600` za fajlove daju vlasniku potrebna prava. Ako se javi `EACCES` ili `EPERM`, proveri vlasništvo i pristup sa hosting podrškom. Konkretni nalog, Passenger startup, Linux fajl-sistem i SMTP prijem nisu provereni lokalnim Windows testovima; konačna potvrda zahteva probu na hostingu.

## Tok i ponavljanje

- Samo `POST /api/orders` pokreće TXT upis, pa slanje. `GET`, čitanje potvrde i osvežavanje stranice ne dodaju redove i ne šalju poruke.
- Server validira podatke i sam računa cene i dostavu; obe poruke koriste isti snimak, broj i datum. Svaka poruka ima svoj SMTP envelope i jednog primaoca; nema CC/BCC. `From` i `Reply-To` su adresa iz konfiguracije.
- Oba slanja se pokušavaju nezavisno, istovremeno, sa ukupnim SMTP rokom od 20 sekundi po poruci. Log sadrži broj porudžbine, vrstu poruke i ograničen kod greške; ne sadrži lozinku, sirove SMTP odgovore ni lične podatke kupca.
- Za isti `requestId`, u okviru istog Node procesa i 24 sata, uspešna poruka se ne šalje ponovo. Istovremeni klikovi dele isti pokušaj. Pri ponovljenom POST-u pokušava se samo prethodno neuspešna poruka. Isti identifikator sa izmenjenim podacima dobija 409. Keš je ograničen na 2.000 pokušaja i postoji samo u RAM-u.
- Projekat nema postojeći sistem pozadinskih poslova. TXT evidencija trajno sprečava ponovni upis istog ID-ja, ali ne beleži statuse isporuke emailova. Nema automatskog trajnog reda ni ponavljanja posle restarta. Restart, više Node procesa ili istek RAM keša mogu dovesti do duplikata emailova kod ponovljenog POST-a. Isti broj porudžbine i stabilan `Message-ID` olakšavaju prepoznavanje duplikata, ali SMTP ne garantuje deduplikaciju. Prekid veze posle SMTP prihvatanja takođe može ostaviti neizvestan ishod. Za sprečavanje ponovnog slanja kroz restart bilo bi potrebno trajno beleženje statusa svakog emaila.

## Provere bez stvarnog slanja

```powershell
npm run check:email
npm run check:orders
node scripts/check-cart.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build:node
```

Email provera koristi lažni transport i Nodemailer `streamTransport` koji samo generiše MIME u memoriji. Obuhvata HTML escaping, tekstualnu alternativu, oba primaoca, zaglavlja, TLS opcije, sve kombinacije delimičnog neuspeha, ponovljene i istovremene zahteve, validaciju, privatnu konfiguraciju i cene za oba načina dostave. Ne proverava stvarnu DreamWeb konekciju/prijem bez lozinke.

Provera `check:orders` koristi privremene test foldere i izmišljene kupce. Obuhvata stvaran upis/čitanje i `fsync`, mesečnu numeraciju, prelazak meseca, letnje vreme, sprečavanje dodatnog reda pri ponovnom pokušaju i posle restarta, paralelan upis iz tri Node procesa, neispravnu putanju, simboličke linkove, zauzetu evidenciju i oporavak nepotpunog upisa. Proverava da neuspešan upis sprečava oba emaila. Ne koristi stvarnu SMTP konfiguraciju.
