import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./studio-v6.css";
import "./graphite.css";
import "./publication.css";

const studioSans = Inter({
 subsets: ["latin", "cyrillic"],
 variable: "--studio-sans",
 display: "swap",
});

export const metadata:Metadata={title:"TQS Studio",description:"TQS Studio — World + Documents + Market Data"};
export default function StudioLayout({children}:{children:React.ReactNode}){
 return <div className={studioSans.variable} style={{height:"100%",minHeight:"100vh"}}>{children}</div>;
}
