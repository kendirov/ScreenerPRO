import type { Metadata } from "next";
import { TradingPreparation } from "@/components/trading/trading-preparation";

export const metadata: Metadata = { title: "Подготовка" };
export default function TradingPreparationPage(){return <TradingPreparation/>;}
