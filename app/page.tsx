import { HomePage } from "@/components/magic/home";
import { StructuredData } from "@/components/magic/structured-data";
import { homeSeo, homeStructuredData, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ path: "/", ...homeSeo });

export default function Page() { return <><HomePage/><StructuredData id="page-schema" data={homeStructuredData()}/></>; }
