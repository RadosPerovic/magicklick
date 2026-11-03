"use client";
import Link from "next/link";
import { useState, useEffect, useRef, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-context";
import { QuoteRows } from "./quote-rows";
import { Plus, Minus, Check, Truck, Package, ShoppingBag, ZoomIn, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Header, Footer } from "./shell";
import { FAQ } from "./faq";
import { InstallationVideos } from "./installation-videos";
import { GalleryVideo } from "./gallery-video";
import { useOrderMode } from "./order-mode";
import { products, imagePath, formatPrice, autoHooksPromoPrice, type Product } from "@/lib/catalog";
import { calculateQuote, type OrderConfig } from "@/lib/orders";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
export function ProductPage({product:p}: {product:Product}){
 const { live } = useOrderMode();
 const[config,setConfig]=useState<OrderConfig>({productId:p.id,quantity:1,hooks:false,delivery:"courier",pickupLocation:"Novi Beograd"});
 const[imageIndex,setImageIndex]=useState(0);const[zoom,setZoom]=useState(false);
 const[galleryVideoEnded,setGalleryVideoEnded]=useState(false);
 const gallery: ({image:string;photoNumber:number}|{video:NonNullable<Product["galleryVideos"]>[number]})[]=p.images.map((image,index)=>({image,photoNumber:index+1}));
 for(const video of p.galleryVideos??[]){
  gallery.splice(video.position-1,0,{video});
 }
 const galleryLength=gallery.length;
 const activeMedia=gallery[imageIndex];
 const activeVideo=activeMedia&&"video" in activeMedia?activeMedia.video:undefined;
 const activePhoto=activeMedia&&"image" in activeMedia?activeMedia:undefined;
 const activeImage=activePhoto?.image??p.images[0];
 const videoSelected=Boolean(activeVideo);
 const showMedia=(index:number)=>{if(index!==imageIndex){setGalleryVideoEnded(false);setImageIndex(index);}};
 const galleryTouchStart=useRef<{id:number;x:number;y:number}|null>(null);
 const gallerySwiped=useRef(false);
 const gallerySwipeHandlers={
  onPointerDown(event:PointerEvent<HTMLElement>){
   if(!event.isPrimary)return;
   gallerySwiped.current=false;
   if(event.pointerType!=="touch"||galleryLength<2)return;
   // Leave the native playback controls available for tapping and scrubbing.
   if(videoSelected&&event.clientY>=event.currentTarget.getBoundingClientRect().bottom-56)return;
   galleryTouchStart.current={id:event.pointerId,x:event.clientX,y:event.clientY};
  },
  onPointerUp(event:PointerEvent<HTMLElement>){
   const start=galleryTouchStart.current;
   if(!start||start.id!==event.pointerId)return;
   galleryTouchStart.current=null;
   const deltaX=event.clientX-start.x;
   const deltaY=event.clientY-start.y;
   if(Math.abs(deltaX)<40||Math.abs(deltaX)<=Math.abs(deltaY)*1.25)return;
   gallerySwiped.current=true;
   const direction=deltaX<0?1:-1;
   showMedia((imageIndex+direction+galleryLength)%galleryLength);
  },
  onPointerCancel(event:PointerEvent<HTMLElement>){
   if(galleryTouchStart.current?.id===event.pointerId)galleryTouchStart.current=null;
  },
 };
 const[reducedMotion,setReducedMotion]=useState(false);
 const[galleryHovered,setGalleryHovered]=useState(false);
 const[galleryFocused,setGalleryFocused]=useState(false);
 const[cartError,setCartError]=useState("");
 const router=useRouter();const cart=useCart();
 const updateConfig=(values:Partial<OrderConfig>)=>setConfig(old=>({...old,...values}));
 const quantityChange=(delta:number)=>updateConfig({quantity:Math.max(1,Math.min(20,config.quantity+delta))});
 useEffect(()=>{
  const preference=window.matchMedia("(prefers-reduced-motion: reduce)");
  const respectPreference=()=>setReducedMotion(preference.matches);
  respectPreference();
  preference.addEventListener("change",respectPreference);
  return()=>preference.removeEventListener("change",respectPreference);
 },[]);
 useEffect(()=>{
  if((p.id!=="hooks"&&p.id!=="moto")||galleryLength<2||reducedMotion||galleryHovered||galleryFocused||zoom||(videoSelected&&!galleryVideoEnded))return;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{
   clearTimeout(timer);
   if(!document.hidden)timer=setTimeout(()=>{setGalleryVideoEnded(false);setImageIndex(index=>(index+1)%galleryLength);},videoSelected?0:5000);
  };
  schedule();
  document.addEventListener("visibilitychange",schedule);
  return()=>{clearTimeout(timer);document.removeEventListener("visibilitychange",schedule);};
 },[p.id,galleryLength,imageIndex,videoSelected,galleryVideoEnded,reducedMotion,galleryHovered,galleryFocused,zoom]);
 useEffect(()=>{
  const context=(document as unknown as {modelContext?:{registerTool:(tool:object,options:object)=>Promise<void>|void}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  try{void Promise.resolve(context.registerTool({name:"calculate_magic_klick_order",title:"Obračun MAGic KLICK porudžbine",description:"Read-only demo price calculation for the selected product, quantity and delivery. Does not submit an order or change the form.",inputSchema:{type:"object",properties:{quantity:{type:"integer",minimum:1,maximum:20},delivery:{type:"string",enum:["courier","pickup"]},hooks:{type:"boolean"}},required:["quantity","delivery"],additionalProperties:false},annotations:{readOnlyHint:true},execute:(input:unknown)=>{if(!input||typeof input!=="object")throw new Error("Neispravan unos");const i=input as Record<string,unknown>;if(typeof i.quantity!=="number"||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>20||!["courier","pickup"].includes(String(i.delivery))||(i.hooks!==undefined&&typeof i.hooks!=="boolean"))throw new Error("Neispravan unos");return {product:p.name,currency:"RSD",mode:"demo",...calculateQuote({productId:p.id,quantity:i.quantity,delivery:i.delivery as "courier"|"pickup",hooks:i.hooks===true,pickupLocation:"Novi Beograd"})}}},{signal:lifecycle.signal})).catch(()=>{});}catch{}return()=>lifecycle.abort();
 },[p.id,p.name]);
 function goToCart(){try{cart.addItem({productId:p.id,quantity:config.quantity,hooks:config.hooks});router.push("/korpa");}catch(error){setCartError(error instanceof Error?error.message:"Proizvod nije dodat u korpu.");}}

 return <><Header/><main><div className="page-intro page-intro-compact"><div className="wrap"><div className="breadcrumbs"><Link href="/">Početna</Link><span>/</span><span>{p.category}</span></div><span className="eyebrow">{p.id==="hooks"?"SVE NA DOHVAT RUKE":"TABLICE BEZ RAMA"}</span><h1>{p.category}<em>.</em></h1><p>{p.id==="hooks"?p.headline:"Tablica u prvom planu. Bez okvira."}</p></div></div>
 <section className="section wrap product-detail"><div className={galleryLength>1?"product-gallery product-gallery-swipe":"product-gallery"} onPointerEnter={event=>{if(event.pointerType==="mouse")setGalleryHovered(true);}} onPointerLeave={()=>setGalleryHovered(false)} onFocusCapture={event=>setGalleryFocused(event.target.matches(":focus-visible"))} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setGalleryFocused(false);}}>{activeVideo?<div className={"main-product-image main-image-"+p.id+" main-image-fill gallery-video-frame"} {...gallerySwipeHandlers}><GalleryVideo key={activeVideo.src} {...activeVideo} active={!zoom} onEnded={()=>setGalleryVideoEnded(true)}/></div>:(<button className={`main-product-image main-image-${p.id} main-image-fill`} {...gallerySwipeHandlers} onClick={event=>{if(!gallerySwiped.current||event.detail===0)setZoom(true);}} aria-label="Uvećaj fotografiju proizvoda"><img src={imagePath(activeImage)} alt={`${p.name} — fotografija ${activePhoto?.photoNumber??1}`} fetchPriority="high"/>{p.id==="hooks"&&<span className="zoom-label"><ZoomIn size={17}/> Uvećaj</span>}</button>)}<div className="thumbnails">{gallery.map((media,index)=>"video" in media?<button key={media.video.src} type="button" onClick={()=>showMedia(index)} aria-label={`Prikaži video: ${media.video.label}`} aria-pressed={index===imageIndex} className={index===imageIndex?"video-thumbnail selected":"video-thumbnail"}><img src={media.video.poster} alt="Pregled videa"/><Play size={16} fill="currentColor" aria-hidden="true"/></button>:<button key={media.image} onClick={()=>showMedia(index)} aria-label={`Prikaži fotografiju ${media.photoNumber}`} aria-pressed={index===imageIndex} className={index===imageIndex?"selected":""}><img src={imagePath(media.image)} alt={`Pregled fotografije ${media.photoNumber}`}/></button>)}</div><p className="small-note">Originalne fotografije sa {(p.id==="hooks"||p.id==="moto")?<a className="gallery-credit-link" href="https://www.instagram.com/magic.klick/" target="_blank" rel="noreferrer">@magic.klick</a>:"@magic.klick"} profila.</p></div>
 <div className="product-config"><span className="eyebrow">{p.id==="auto"?"ČIST IZGLED UZ JEDAN KLICK":p.id==="moto"?"ČIST IZGLED UZ JEDAN KLICK":"PAMETNI DETALJ ZA ODLAGANJE"}</span><h2>{p.name}</h2><p className="product-description">{p.description}</p><div className="detail-price">{formatPrice(p.price)}<span>/ {p.unit}</span>{!live&&<small>Demo cena · finalni cenovnik naknadno</small>}</div><div className="product-specs"><span><span className="color-dot"/> Crna</span><span><Package size={15}/>{p.id==="auto"?"Za obe tablice":p.id==="moto"?"Za jednu moto tablicu":"Par kukica"}</span><span><Check size={15}/> Made in Serbia</span></div>
 <div className="quantity-line"><div><strong>Količina</strong></div><div className="quantity-picker"><button aria-label="Smanji količinu" disabled={config.quantity===1} onClick={()=>quantityChange(-1)}><Minus size={16}/></button><output aria-live="polite" aria-label="Izabrana količina">{config.quantity}</output><button aria-label="Povećaj količinu" disabled={config.quantity===20} onClick={()=>quantityChange(1)}><Plus size={16}/></button></div></div>
 {p.id==="auto"&&<label className="addon-card" htmlFor="extra-hooks"><Checkbox id="extra-hooks" checked={config.hooks} onCheckedChange={checked=>updateConfig({hooks:checked===true})}/><span><strong>Dodaj MAGic KLICK HOOKS</strong><small>Par kukica u kabini po promo ceni uz poručen držač za auto</small></span><b>+{formatPrice(autoHooksPromoPrice)}</b></label>}
 <div className="quick-quote" aria-live="polite"><QuoteRows config={config} includeDelivery={false}/><p className="small-note">Dostava se obračunava u korpi, nakon unosa podataka.</p></div><button className="btn primary order-cta" onClick={goToCart} disabled={!cart.ready}><ShoppingBag size={17}/> Dodaj u korpu</button>{cartError&&<p className="field-error" role="alert">{cartError}</p>}<div className="config-benefits"><span><Truck size={15}/> Dostava putem postexpressa</span></div>{!live&&<div className="demo-notice"><strong>Isprobaj bez obaveze.</strong> Ovo je demo shop. Cene i pogodnosti su primeri, a potvrda ne šalje porudžbinu.</div>}
 </div></section>
 <section className="wrap product-tabs-section"><Tabs defaultValue="details"><TabsList variant="line" className="product-tabs"><TabsTrigger value="details">O proizvodu</TabsTrigger><TabsTrigger value="contents">Sadržaj kompleta</TabsTrigger></TabsList><TabsContent value="details"><div className={p.id==="auto"?"tab-content auto-product-details":"tab-content"}><div className="product-details-copy"><h3>{p.id==="auto"?"Držači za tablice bez rama i okvira. Bez reklama. Tablica u prvom planu.":p.id==="moto"?"Držač za tablicu motora bez rama i okvira. Bez reklama. Tablica u prvom planu.":p.headline}</h3>{p.id==="auto"?<><p><strong>MAGic KLICK</strong> držači za registarske tablice bez rama donose minimalistički izgled koji pravi veliku razliku. Bez glomaznih okvira, nepotrebnih reklama i detalja koji narušavaju estetiku automobila. Gotovo nevidljivi, a izuzetno čvrsti, pružaju sigurno držanje tablica čak i pri velikim brzinama i u ekstremnim vremenskim uslovima.</p><p>Proizvedeni u Srbiji, tehnologijom brizganja najkvalitetnije ABS plastike, MAGic KLICK nosači tablica spajaju moderan dizajn, izdržljivost i pouzdanost. Garantujemo čvrsto držanje tablica uz doživotnu garanciju.</p><p><strong>Minimalna promena. Maksimalan efekat.</strong></p></>:p.id==="moto"?<><p><strong>MAGic KLICK</strong> držač za registarsku tablicu motocikla donosi minimalistički izgled koji pravi veliku razliku. Bez glomaznih okvira, nepotrebnih reklama i detalja koji narušavaju linije tvog motora. Diskretan nosač ostavlja tablicu u prvom planu i čuva čist izgled motocikla.</p><p>Proizveden u Srbiji, MAGic KLICK moto držač spaja moderan dizajn i praktičnost. Namenjen je za jednu registarsku tablicu motocikla, uz šrafove za montažu koji dolaze u kompletu.</p><p><strong>Minimalna promena. Maksimalan efekat.</strong></p></>:<><p>MAGic KLICK su praktične kukice za auto sedišta koje omogućavaju jednostavno odlaganje torbi, kesa, rančeva i drugih sitnica tokom vožnje.</p><p>Postavljaju se na nosače naslona za glavu vozačevog ili suvozačevog sedišta, bez potrebe za dodatnim alatom. Omogućavaju bolje iskorišćenje prostora u automobilu i pomažu da stvari budu uredno organizovane, umesto da zauzimaju mesto na sedištima ili podu vozila.</p><p>Jednostavno i funkcionalno rešenje za svakodnevnu upotrebu, kupovinu i putovanja.</p></>}</div>
 {p.id==="auto"&&(
  <img
   className="auto-product-plate"
   src="/images/MKauto-tablica.webp"
   alt="MAGic KLICK tablica sa četiri držača"
   width={1200}
   height={307}
   loading="lazy"
  />
 )}
 </div></TabsContent><TabsContent value="contents"><div className="tab-content"><h3>U tvom MAGic KLICK pakovanju</h3>{p.id==="auto"?<p>MAGic KLICK auto komplet sadrži 4 nosača za registarske tablice bez rama: 2 za prednju i 2 za zadnju tablicu automobila. U kompletu dobijaš i šrafove za montažu, tako da jednim kompletom opremaš obe tablice svog automobila.</p>:p.id==="moto"?<p>MAGic KLICK moto komplet namenjen je za jedan motor, odnosno za jednu registarsku tablicu motocikla. Uz komplet za pričvršćivanje tablice bez rama dobijaš i šrafove za montažu.</p>:<p>MAGic KLICK komplet sadrži par kukica za naslone za glavu sedišta u automobilu. Ove kukice za auto služe za kačenje torbi, kesa i drugih stvari, kako bi unutrašnjost automobila bila urednija.</p>}</div></TabsContent></Tabs></section>
 {p.id!=="hooks"&&<InstallationVideos productId={p.id}/>}<section className="section wrap faq-section"><div><span className="eyebrow">PRE NEGO ŠTO KLIKNEŠ</span><h2>Dobro je <em>znati.</em></h2><p>Često postavljana pitanja.<br/>Odgovori na jednom mestu.</p></div><FAQ/></section><section className="related-section wrap"><div className="section-heading"><div><span className="eyebrow">JOŠ IZ MAGIC KLICK PONUDE</span><h2>Detalji koji idu <em>zajedno.</em></h2></div></div><div className="related-grid">{products.filter(item=>item.id!==p.id).map(item=><Link href={`/${item.slug}`} className="related-card" key={item.id}><img src={imagePath(item.images[0])} alt={item.name} loading="lazy"/><div><small>{item.category}</small><h3>{item.name}</h3><p>{formatPrice(item.price)}{!live&&" · demo cena"}</p><span className="text-link">Pogledaj proizvod</span></div></Link>)}</div></section>
 </main><Footer/>
 <Dialog open={zoom} onOpenChange={setZoom}><DialogContent className="zoom-dialog"><DialogTitle>{p.name}</DialogTitle><DialogDescription>{videoSelected?"Video":"Fotografija"} {imageIndex+1} od {galleryLength} · @magic.klick</DialogDescription>{activeVideo?<GalleryVideo {...activeVideo} active={zoom} className="zoom-gallery-video"/>:<img className="zoom-image" src={imagePath(activeImage)} alt={p.name}/>}{galleryLength>1&&<div className="zoom-controls"><button className="btn outline" aria-label="Prethodna fotografija" onClick={()=>showMedia((imageIndex+galleryLength-1)%galleryLength)}><ChevronLeft size={17}/></button><span>{imageIndex+1} / {galleryLength}</span><button className="btn outline" aria-label="Sledeća fotografija" onClick={()=>showMedia((imageIndex+1)%galleryLength)}><ChevronRight size={17}/></button></div>}</DialogContent></Dialog>
 </>;}
