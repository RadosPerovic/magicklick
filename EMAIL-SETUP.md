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

Apsolutna putanja poput `/home/CPANEL_USER/orders` i dalje je podržana ako ti zatreba. U oba slučaja odredište mora ostati van aplikacije i javnog document root-a. `./orders` označava folder unutar aplikacije i zato se odbija. Aplikaciju lokalno pokreći iz njenog osnovnog direktorijuma; u cPanel-u to je podešeni Application root. Generisani standalone `server.js` automatski koristi svoj direktorijum kao radni direktorijum. Na hostingu postavi sadržaj `dist/standalone` kao aplikacioni direktorijum, npr. `/home/CPANEL_USER/magic-klick`; evidencija će tada biti `/home/CPANEL_USER/orders`. Nemoj standalone izdanje pokretati za stvarne porudžbine unutar projektnog `dist` foldera: evidencija ne sme biti u build folderu. Relativna putanja je serverska putanja na disku, a ne ruta sajta. Roditeljski direktorijum mora dozvoljavati pisanje Node procesu. Putanje kroz simboličke linkove se proveravaju; lokacije u `public_html`, `public`, `www`, `htdocs`, `dist` i `.next` se odbijaju. Na Linuxu se novi folder kreira sa dozvolama `700`, a fajlovi sa `600`. Ne postavljaj statičku rutu za ovaj folder. Uključi ga u serverski backup; ne ide u Git ili build.

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

Podrazumevana konfiguracija je **`private/order-email.json` u okviru projekta**, nalik `appsettings.json`. Automatski se čita u lokalnom i produkcionom Node režimu; `MAGIC_KLICK_EMAIL_CONFIG` nije obavezan. Fajl se čita samo na serveru i ne uvozi se u JavaScript za pregledač.

`npm run build` automatski kopira ovu konfiguraciju u **`dist/standalone/private/order-email.json`**. Prenesi ceo sadržaj `dist/standalone` na Node hosting, uključujući `private` folder. Podešavanja u kopiranom JSON-u koristi produkcija. Posle promene projektnog fajla ponovo napravi i postavi build; direktnu izmenu serverske kopije aktivira restart aplikacije.

Verzionisan primer bez tajni: `config/order-email.example.json`. Po zahtevu vlasnika projekta, i `private/order-email.json` je uključen u Git verzionisanje. Lozinka koja se unese u taj fajl može ući u Git istoriju. Ni projekat ni standalone paket ne postavljaj kao statički javni direktorijum; javni resursi su isključivo u `public` i `dist/client`. Menjaju se sledeća polja:

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
npm run dev
```

Popuni postojeći `private/order-email.json`. Ako ne postoji, napravi ga kopiranjem `config/order-email.example.json`; ne prepisuj već popunjenu kopiju. Konfiguracija sa `enabled: false` ne šalje emailove. Lozinka sa praznom vrednošću ne dozvoljava uključivanje slanja. Ako je ostala ranije postavljena promenljiva `MAGIC_KLICK_EMAIL_CONFIG`, ukloni je da bi se koristio projektni fajl. Promenljiva i dalje može opciono pokazivati na drugi privatni JSON fajl preko apsolutne putanje.

## Produkcija na Node.js hostingu

1. Potreban je hosting paket sa podrškom za Node.js 22.13 ili noviji, trajnim upisivim diskom i izlaznom SMTP konekcijom ka DreamWeb serveru. Proveri dostupnost opcije **Setup Node.js App** i odgovarajuće verzije u konkretnom cPanel nalogu. DreamWeb podržava Node.js samo na određenim paketima; javno uputstvo ne potvrđuje verzije dostupne na tvom nalogu. Vercel nije podržan za ovu lokalnu TXT evidenciju. Statički hosting sam ne može slati ove poruke.
2. U projektu popuni **`private/order-email.json`**: potvrdi host/port/enkripciju u cPanel-u, lozinku, pošiljaoca i prijemno sanduče. U JSON-u koristi validne JSON escape sekvence ako lozinka sadrži navodnike ili obrnutu kosu crtu. Kada si spreman za stvarno slanje, postavi `enabled: true`.
3. Instaliraj zavisnosti i napravi produkcioni Node paket: **`npm ci`**, zatim **`npm run build`**. Komande `dev`, `build` i `start` podrazumevano koriste Node profil; ranije `:node` komande ostaju podržane. Cloudflare/Sites pregled ostaje izdvojen kao `dev:preview`, `build:preview` i `start:preview`, sa poručivanjem isključenim.
4. Postavi **ceo sadržaj `dist/standalone`** u privatni aplikacioni direktorijum van `public_html`, npr. `/home/CPANEL_USER/magic-klick`. Paket već sadrži `private/order-email.json`, `app.cjs`, `server.js`, resurse i runtime zavisnosti. Ograniči pristup konfiguraciji na vlasnika procesa (`chmod 600`, privatni direktorijum `chmod 700`). Ne izlaži `private` folder kroz web-server.
5. **Na DreamWeb deljenom hostingu aplikaciju pokreći i restartuj kroz cPanel → Setup Node.js App**, prema [njihovom uputstvu](https://helpdesk.dreamweb.rs/sr/baza-znanja/article/pokretanje-node-js-aplikacije); ono izričito ne podržava pokretanje preko `start` skripte iz `package.json`. Postavi Production režim, aplikacioni direktorijum iz prethodnog koraka i startup fajl `app.cjs`, koji build automatski generiše kao CommonJS wrapper za ESM `server.js`. Konkretno cPanel/Passenger okruženje proveri nakon postavljanja. Za standardan samostalan Node hosting pokreni `node server.js` iz postavljenog paketa. Proxy mora prepisivati IP zaglavlja, uz sopstveno ograničenje broja zahteva.
6. **Nisu potrebne putanje kroz environment variables.** Podrazumevano se koristi `private/order-email.json` i evidencija `../orders`. Ukloni stare promenljive `MAGIC_KLICK_EMAIL_CONFIG` i `MAGIC_KLICK_ORDERS_DIRECTORY` ako želiš ova podrazumevana podešavanja. Obe promenljive i dalje ostaju opcione zamene. Konfiguracija u javnim folderima se odbija, uključujući putanje kroz simboličke linkove. Fajl se čita na prvom zahtevu, a uspešno učitani servis se koristi do restarta. Posle izmene serverskog JSON-a restartuj proces.
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
npm run check:deployment
```

Email provera koristi lažni transport i Nodemailer `streamTransport` koji samo generiše MIME u memoriji. Obuhvata HTML escaping, tekstualnu alternativu, oba primaoca, zaglavlja, TLS opcije, sve kombinacije delimičnog neuspeha, ponovljene i istovremene zahteve, validaciju, automatsko učitavanje projektnog JSON-a u produkciji, kopiranje konfiguracije uz standalone server i cene za oba načina dostave. Ne proverava stvarnu DreamWeb konekciju/prijem bez slanja.

Provera `check:orders` koristi privremene test foldere i izmišljene kupce. Obuhvata stvaran upis/čitanje i `fsync`, mesečnu numeraciju, prelazak meseca, letnje vreme, sprečavanje dodatnog reda pri ponovnom pokušaju i posle restarta, paralelan upis iz tri Node procesa, neispravnu putanju, simboličke linkove, zauzetu evidenciju i oporavak nepotpunog upisa. Proverava da neuspešan upis sprečava oba emaila. Ne koristi stvarnu SMTP konfiguraciju.

`check:deployment` se pokreće posle Node builda. Proverava da je kopirani JSON isti kao projektni fajl, da lozinka nije u javnom JavaScript-u i da produkcioni standalone server učitava konfiguraciju bez promenljive za putanju čak i kada se pokrene iz drugog direktorijuma. GET provera ne otvara SMTP vezu. Konfiguracioni URL-ovi moraju vratiti 404. Ne šalje porudžbine niti emailove.
