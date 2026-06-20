import { CbrRateReactionPage } from "@/components/lab/cbr-rate-reaction/cbr-rate-reaction-page";

export const metadata = {
  title: "Ставка ЦБ: replay | ScreenerPRO",
  description: "Исторический replay реакции MOEX на заседания Банка России.",
};

export default function LabCbrRateReactionRoutePage() {
  return <CbrRateReactionPage />;
}
