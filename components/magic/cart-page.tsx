"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Plus, Minus, Truck, MapPin, Phone, Camera, ShoppingBag, Trash2, LoaderCircle, CheckCircle2 } from "lucide-react";
import { Header, Footer } from "./shell";
import { useCart } from "./cart-context";
import { useOrderMode } from "./order-mode";
import { submitCartOrder } from "@/lib/submit-cart-order";
import { CustomerField } from "./customer-field";
import { products, imagePath, formatPrice, shipping } from "@/lib/catalog";
import { calculateQuote, validateCustomer, type Customer, type OrderConfig, type OrderReceipt } from "@/lib/orders";
import { calculateCartQuote, submitDemoCartOrder, type CartItem, type CartPayload } from "@/lib/cart";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const emptyCustomer: Customer = { name: "", phone: "", email: "", city: "", postalCode: "", address: "", note: "" };
const pickupContacts = [
  { location: "Novi Beograd", phone: "+381653613281" },
  { location: "Zemun", phone: "+381648575644" },
  { location: "Smederevo", phone: "+381652613281" },
];

function CartQuoteRows({ items, delivery, includeDelivery }: { items: CartItem[]; delivery: OrderConfig["delivery"]; includeDelivery: boolean }) {
  const quote = calculateCartQuote(items, delivery);
  return <div className="quote-rows">
    {items.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      const line = calculateQuote({ ...item, delivery, pickupLocation: "" });
      return <div className="cart-quote-item" key={item.productId}>
        <div><span>{product.name} × {item.quantity}</span><strong>{formatPrice(line.productTotal)}</strong></div>
        {line.extras > 0 && <div><span>MAGic KLICK HOOKS · 1 par</span><strong>{formatPrice(line.extras)}</strong></div>}
      </div>;
    })}
    {includeDelivery && <div><span>{delivery === "pickup" ? "Lično preuzimanje" : delivery === "post-office" ? "Post Express — preuzimanje u pošti" : "Post Express — na adresu"}</span><strong>{quote.delivery === 0 ? "Besplatno" : formatPrice(quote.delivery)}</strong></div>}
    <div className="total-row"><span>{includeDelivery ? "Ukupno" : "Ukupno za proizvode"}</span><strong>{formatPrice(includeDelivery ? quote.total : quote.subtotal)}</strong></div>
  </div>;
}

export function CartPage() {
  const { live, ready: modeReady } = useOrderMode();
  const submissionId = useRef("");
  const { items, ready, updateItem, removeItem, clearCart } = useCart();
  const [delivery, setDelivery] = useState<OrderConfig["delivery"]>("courier");
  const [customer, setCustomer] = useState<Customer>({ ...emptyCustomer });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateCustomer>>({});
  const [snapshot, setSnapshot] = useState<CartPayload | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const quote = calculateCartQuote(items, delivery);
  const deliveryReady = delivery === "pickup" || Object.keys(validateCustomer(customer, delivery)).length === 0;

  function changeCustomer(name: keyof Customer, value: string) {
    setCustomer(old => ({ ...old, [name]: value }));
    setErrors(old => ({ ...old, [name]: undefined }));
  }
  function onReview(event: FormEvent) {
    event.preventDefault();
    if (delivery === "pickup") return;
    const next = validateCustomer(customer, delivery);
    if (!consent) next.consent = live ? "Potvrdi da su uneti podaci tačni." : "Potvrdi da razumeš demo režim.";
    setErrors(next);
    if (Object.keys(next).length) {
      const key = Object.keys(next)[0];
      requestAnimationFrame(() => {
        const field = formRef.current?.querySelector<HTMLElement>(`[name="${key}"], #${key}`);
        field?.focus();
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    if (!items.length || !modeReady) return;
    submissionId.current = crypto.randomUUID();
    setSnapshot({ items: items.map(item => ({ ...item })), delivery, pickupLocation: "", customer: { ...customer, ...(delivery === "post-office" ? { city: "", address: "" } : {}) } });
    setSubmitError("");
    setReview(true);
  }
  async function confirm() {
    if (!snapshot || snapshot.delivery === "pickup" || busy) return;
    setBusy(true);
    try {
      setReceipt(live ? await submitCartOrder(snapshot, submissionId.current) : await submitDemoCartOrder(snapshot));
      setReview(false);
      clearCart();
      setCustomer({ ...emptyCustomer });
      setConsent(false);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Potvrda nije uspela. Pokušaj ponovo."); }
    finally { setBusy(false); }
  }

  return <><Header/><main>
    <div className="page-intro page-intro-compact"><div className="wrap">
      <div className="breadcrumbs"><Link href="/">Početna</Link><span>/</span><span>Korpa</span></div>
      <h1>Tvoja korpa<em>.</em></h1><p>Pregled proizvoda, dostava i podaci za poručivanje.</p>
    </div></div>
    {!ready ? <section className="wrap cart-empty" role="status">Učitavanje korpe…</section> : !items.length ? <section className="wrap cart-empty">
      <ShoppingBag size={38} aria-hidden="true"/><h2>Korpa je prazna.</h2><p>Izaberi proizvode i dodaj ih u korpu.</p><Link className="btn primary" href="/#kolekcija">Pogledaj proizvode</Link>
    </section> : <section className="order-section cart-checkout"><div className="wrap">
      <div className="section-heading"><div><span className="eyebrow">JOŠ PAR DETALJA I TO JE TO</span><h2>Tvoji proizvodi.<br/><em>Tvoja porudžbina.</em></h2></div>{!live&&<span className="demo-pill">DEMO REŽIM · BEZ SLANJA</span>}</div>
      <div className="order-grid"><form noValidate onSubmit={onReview} ref={formRef} className="customer-form">
        <h3><span>01</span> Način isporuke</h3>
        <RadioGroup value={delivery} onValueChange={value => { if (value !== delivery) { setDelivery(value as OrderConfig["delivery"]); setCustomer(old => ({ ...old, address: "" })); setErrors({}); setReview(false); setSnapshot(null); setSubmitError(""); } }} className="delivery-options" aria-label="Način isporuke">
          <label className={delivery === "courier" ? "delivery-option selected" : "delivery-option"}><RadioGroupItem value="courier"/><Truck size={22}/><span><strong>Post Express</strong><small>Na tvoju adresu u Srbiji</small></span></label>
          <label className={delivery === "post-office" ? "delivery-option selected" : "delivery-option"}><RadioGroupItem value="post-office"/><Truck size={22}/><span><strong>Post Express</strong><small>Preuzimanje u pošti</small></span></label>
          <label className={`delivery-option pickup-delivery-option${delivery === "pickup" ? " selected" : ""}`}><RadioGroupItem value="pickup"/><MapPin size={22}/><span><strong>Lično preuzimanje</strong><small>Po dogovoru · bez poštarine</small></span></label>
        </RadioGroup>
        {delivery === "pickup" ? <div className="cart-pickup-contacts">
          <h3><span>02</span> Dogovori lično preuzimanje</h3>
          <p>Pozovi nas na broj za željenu lokaciju i dogovori preuzimanje.</p>
          <ul>
            {pickupContacts.map(contact => <li key={contact.location}><span><MapPin size={16} aria-hidden="true"/>{contact.location}</span><a href={`tel:${contact.phone}`}><Phone size={16} aria-hidden="true"/>{contact.phone}</a></li>)}
          </ul>
          <div className="pickup-instagram"><p>Ili nam piši na Instagramu</p><a href="https://www.instagram.com/magic.klick/" className="btn primary" target="_blank" rel="noreferrer"><Camera size={20} aria-hidden="true"/> Piši nam · @magic.klick</a></div>
        </div> : <>
        {delivery === "post-office" && <p className="small-note">Unesi poštanski broj pošte u kojoj želiš da preuzmeš paket.</p>}
        <h3><span>02</span> Tvoji podaci</h3><p className="form-intro">{live ? "Unesi podatke potrebne za obradu i isporuku porudžbine." : "Možeš koristiti izmišljene podatke za testiranje. Podaci se ne šalju i ne čuvaju na serveru."}</p>
        <div className="form-grid">
          <div className="span-two"><CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="name" label="Ime i prezime *" placeholder="npr. Marko Marković" autoComplete="name"/></div>
          {delivery !== "courier" && <>
            <CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="postalCode" label="Poštanski broj *" placeholder="npr. 11000" autoComplete="postal-code"/>
            <CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="phone" label="Telefon *" placeholder="npr. 064 123 4567" type="tel" autoComplete="tel"/>
            <div className="span-two"><CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="email" label="Email" placeholder="npr. marko@email.com" type="email" autoComplete="email"/></div>
          </>}
          {delivery === "courier" && <>
            <CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="city" label="Mesto *" placeholder="npr. Beograd" autoComplete="address-level2"/>
            <CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="postalCode" label="Poštanski broj *" placeholder="npr. 11000" autoComplete="postal-code"/>
            <div className="span-two"><CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="address" label="Ulica i broj *" placeholder="npr. Ulica primera 12, stan 3" autoComplete="street-address"/></div>
          </>}
          {delivery === "courier" && <>
            <CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="phone" label="Telefon *" placeholder="npr. 064 123 4567" type="tel" autoComplete="tel"/>
            <CustomerField customer={customer} errors={errors} changeCustomer={changeCustomer} name="email" label="Email" placeholder="npr. marko@email.com" type="email" autoComplete="email"/>
          </>}
          <div className="form-field span-two"><label htmlFor="note">Napomena <span>(opciono)</span></label><textarea id="note" name="note" placeholder="Model vozila, pitanje ili napomena..." value={customer.note} maxLength={1000} onChange={event => changeCustomer("note", event.target.value)}/></div>
        </div>
        <label className="consent-label" htmlFor="consent"><Checkbox id="consent" name="consent" checked={consent} onCheckedChange={value => { setConsent(value === true); setErrors(old => ({ ...old, consent: undefined })); }} aria-invalid={!!errors.consent}/><span>{live ? "Potvrđujem da su podaci tačni i želim da pošaljem porudžbinu." : "Razumem da je ovo demo porudžbina, bez slanja i naplate."}</span></label>
        {errors.consent && <p role="alert" className="field-error">{errors.consent}</p>}
        <button type="submit" className="btn primary review-button" disabled={!modeReady}><ShoppingBag size={17}/>{live ? "Pregledaj porudžbinu" : "Pregledaj demo porudžbinu"}</button><span className="form-last-note">Prvo pregledaš detalje, pa potvrđuješ.</span>
        </>}
      </form>
      <aside className="order-summary"><h3>Pregled porudžbine</h3>
        {items.map(item => { const product = products.find(p => p.id === item.productId)!; return <div className="cart-item" key={item.productId}>
          <div className="summary-product"><Link href={`/${product.slug}`}><img src={imagePath(product.images[0])} alt={product.name}/></Link><div><Link href={`/${product.slug}`}><strong>{product.name}</strong></Link><span>Crna · {product.unit}</span>
            <div className="summary-qty"><button type="button" aria-label={`Smanji količinu: ${product.name}`} disabled={item.quantity === 1} onClick={() => updateItem(item.productId, { quantity: item.quantity - 1 })}><Minus size={13}/></button><span>{item.quantity}</span><button type="button" aria-label={`Povećaj količinu: ${product.name}`} disabled={item.quantity === 20} onClick={() => updateItem(item.productId, { quantity: item.quantity + 1 })}><Plus size={13}/></button></div>
          </div><button type="button" className="cart-remove" aria-label={`Ukloni iz korpe: ${product.name}`} onClick={() => removeItem(item.productId)}><Trash2 size={17}/></button></div>
          {item.productId === "auto" && item.hooks && <label className="cart-addon"><Checkbox checked onCheckedChange={() => updateItem(item.productId, { hooks: false })}/><span>MAGic KLICK HOOKS · 1 par</span></label>}
        </div>; })}
        <CartQuoteRows items={items} delivery={delivery} includeDelivery={deliveryReady}/>
        {!deliveryReady && <p className="small-note" role="status">Dostava će biti obračunata nakon unosa podataka za poručivanje.</p>}
        {deliveryReady && delivery !== "pickup" && <div className="shipping-progress"><div><span>{quote.delivery === 0 ? "Tvoja dostava je besplatna." : `Još ${formatPrice(shipping.freeFrom - quote.subtotal)} do besplatne dostave.`}</span></div><div className="shipping-track"><span style={{ width: `${Math.min(100, quote.subtotal / shipping.freeFrom * 100)}%` }}/></div><small>{live ? "Besplatna dostava od " : "Demo uslov: besplatna dostava od "}{formatPrice(shipping.freeFrom)}.</small></div>}
        <Link href="/#kolekcija" className="text-link cart-continue">Nastavi sa kupovinom</Link>{!live&&<p className="small-note">Sve cene i dostava su simulirani. Finalni uslovi biće potvrđeni pri aktiviranju shopa.</p>}
      </aside></div>
    </div></section>}
  </main><Footer/>
  <Dialog open={review} onOpenChange={value => { if (!busy) setReview(value); }}><DialogContent className="review-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogTitle>Još jedan pogled pre klika.</DialogTitle><DialogDescription>{live ? "Proveri proizvode, iznos i podatke za isporuku pre potvrde porudžbine." : "Proveri podatke svoje demo porudžbine. Nema slanja, naplate ni emaila."}</DialogDescription>
    {snapshot && <><div className="review-details"><div><small>KONTAKT</small><strong>{snapshot.customer.name}</strong><span>{snapshot.customer.phone}</span>{snapshot.customer.email && <span>{snapshot.customer.email}</span>}</div><div><small>{snapshot.delivery === "post-office" ? "POŠTA ZA PREUZIMANJE" : "ADRESA DOSTAVE"}</small>{snapshot.delivery === "post-office" ? <span>Poštanski broj: {snapshot.customer.postalCode}</span> : <span>{snapshot.customer.address}<br/>{snapshot.customer.postalCode} {snapshot.customer.city}</span>}</div>{snapshot.customer.note && <div><small>NAPOMENA</small><span>{snapshot.customer.note}</span></div>}</div><CartQuoteRows items={snapshot.items} delivery={snapshot.delivery} includeDelivery/></>}
    {submitError && <p role="alert" className="field-error">{submitError}</p>}<button className="btn primary" disabled={busy} onClick={confirm}>{busy ? <><LoaderCircle className="spin" size={18}/> Potvrđujem...</> : live ? "Potvrdi porudžbinu" : "Potvrdi demo porudžbinu"}</button><button className="text-link review-back" disabled={busy} onClick={() => setReview(false)}>Izmeni podatke</button>
  </DialogContent></Dialog>
  <Dialog open={!!receipt} onOpenChange={value => { if (!value) { setReceipt(null); setSnapshot(null); } }}><DialogContent className="success-dialog"><CheckCircle2 className="success-icon" size={48} strokeWidth={1.2}/><DialogTitle>{receipt?.mode === "live" ? "Porudžbina je primljena." : "Tvoj demo klik je uspeo."}</DialogTitle><DialogDescription>{receipt?.mode === "live" ? "Hvala na porudžbini! Sačuvaj broj porudžbine za dalja pitanja." : "Ovako će izgledati potvrda porudžbine. Ništa nije poslato ni naplaćeno."}</DialogDescription>{receipt && <><div className="receipt-id">{receipt.id}</div><div className="receipt-info"><span>Ukupno</span><strong>{formatPrice(receipt.total)}</strong></div></>}<a className="btn primary" href="https://www.instagram.com/magic.klick/" target="_blank" rel="noreferrer">Piši nam na Instagramu</a><Link className="btn outline" href="/#kolekcija" onClick={() => { setReceipt(null); setSnapshot(null); }}>Pogledaj proizvode</Link></DialogContent></Dialog>
  </>;
}
