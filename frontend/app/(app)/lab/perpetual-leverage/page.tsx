import { PerpetualLeverageLabPage } from "@/components/lab/perpetual-leverage/perpetual-leverage-lab-page";

export const metadata = {
  title: "Leverage Liquidation Map | ScreenerPRO",
  description: "Интерактивная карта ликвидации в perpetual-фьючерсах: плечо и расстояние до ликвидации.",
};

export default function PerpetualLeverageLabRoutePage() {
  return <PerpetualLeverageLabPage />;
}
