"use client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
const questions=[
 ["Šta dobijam u kompletu za automobil?","MAGic KLICK auto komplet sadrži 4 nosača za registarske tablice bez rama: 2 za prednju i 2 za zadnju tablicu automobila. U kompletu dobijaš i šrafove za montažu, tako da jednim kompletom opremaš obe tablice svog automobila."],
 ["Šta dobijam u kompletu za motor?","MAGic KLICK moto komplet namenjen je za jedan motor, odnosno za jednu registarsku tablicu motocikla. Uz komplet za pričvršćivanje tablice bez rama dobijaš i šrafove za montažu."],
 ["Šta dobijam u Hooks kompletu?","MAGic KLICK Hooks komplet sadrži par kukica za naslone za glavu sedišta u automobilu. Ove kukice za auto služe za kačenje torbi, kesa i drugih stvari, kako bi unutrašnjost automobila bila urednija."],
 ["Da li držač odgovara mom vozilu?","MAGic KLICK držači za registarske tablice kompatibilni su sa gotovo svim automobilima, a za pravilno uklapanje važna je širina tablice. Ako nisi siguran da li odgovaraju tvom vozilu, pošalji nam upit i fotografiju tablice na Instagram @magic.klick ili nas pozovi na jedan od brojeva navedenih u podnožju sajta. Tu smo da pomognemo pri izboru."],
 ["Da li su MAGic KLICK držači dostupni u drugim bojama?","MAGic KLICK držači su trenutno dostupni isključivo u crnoj boji. Zahvaljujući minimalističkom dizajnu, gotovo su nevidljivi i savršeno se uklapaju uz ivicu registarske tablice. Upravo zato nema potrebe za drugim bojama – cilj je da držači ostanu neprimetni, a tablica bude u prvom planu."],
 ["Gde je moguće lično preuzimanje?","Lično preuzimanje je moguće na Novom Beogradu, Zemunu i Smederevu, uz prethodni dogovor preko Instagram poruke ili putem poziva."],
 ["Kako se šalje paket?","Pakete šaljemo Post Expressom. Poštarina za dostavu na adresu iznosi 600 dinara, a za preuzimanje u pošti 480 dinara. Rok isporuke je od 1 do 3 dana."]
];
export function FAQ(){return <Accordion type="single" collapsible className="faq-list">{questions.map(([q,a],i)=><AccordionItem value={`q${i}`} key={q}><AccordionTrigger className="faq-trigger">{q}</AccordionTrigger><AccordionContent className="faq-answer">{a}</AccordionContent></AccordionItem>)}</Accordion>}
