"use client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
const questions=[
 ["Šta dobijam u kompletu za automobil?","Auto komplet je namenjen za prednju i zadnju tablicu. Moto držač je poseban proizvod za tablicu motocikla. Fotografije prikazuju originalna Magic Klick pakovanja; sadržaj i kompatibilnost finalnog kompleta potvrđujemo pre prave porudžbine."],
 ["Da li držač odgovara mom vozilu?","Važni su format tablice, postojeći nosač i mesta za pričvršćivanje. Ako nisi siguran, pošalji fotografiju tablice i nosača na @magic.klick da proverimo odgovarajući proizvod za tvoj auto ili motor."],
 ["Kako se montira držač bez rama?","Princip je jednostavan: ukloni stari ram, postavi držače na odgovarajuća mesta za pričvršćivanje i pažljivo ubaci tablicu. Prati uputstvo uz proizvod i na kraju proveri da tablica čvrsto stoji. Za detaljan prikaz pogledaj Instagram highlight „montiranje“."],
 ["Gde je moguće lično preuzimanje?","Lično preuzimanje je moguće u Novom Beogradu, Zemunu i Smederevu, uz prethodni dogovor preko Instagram poruke. U demo formi možeš da izabereš lokaciju i vidiš obračun bez troška dostave."],
 ["Da li ova forma šalje pravu porudžbinu?","Trenutno je shop u demo režimu. Možeš da isprobaš kalkulator, popuniš formu i dobiješ demo potvrdu, ali ništa se ne šalje emailom, ne naplaćuje i ne čuva na serveru. Za stvarnu porudžbinu kontaktiraj @magic.klick."],
 ["Da li su cene i dostava konačne?","Ne. Prikazane cene, količinski popust i besplatna dostava su primeri za testiranje shopa. Pravi cenovnik, dostupnost i uslovi dostave biće uneti pre aktiviranja poručivanja."]
];
export function FAQ(){return <Accordion type="single" collapsible className="faq-list">{questions.map(([q,a],i)=><AccordionItem value={`q${i}`} key={q}><AccordionTrigger className="faq-trigger">{q}</AccordionTrigger><AccordionContent className="faq-answer">{a}</AccordionContent></AccordionItem>)}</Accordion>}
