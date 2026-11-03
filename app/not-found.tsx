import Link from "next/link";
import { Header, Footer } from "@/components/magic/shell";
export default function NotFound(){return <><Header/><main className="not-found wrap"><span className="eyebrow">404 · IZGUBLJEN KLIK</span><h1>Ovde nema rama.<br/><em>A ni stranice.</em></h1><p>Vrati se na početnu i pronađi svoj MAGic KLICK.</p><Link href="/" className="btn primary">Nazad na početnu</Link></main><Footer/></>}
