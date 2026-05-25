import { Suspense } from "react";
import { OrderflowSimulatorPage } from "@/components/lab/orderflow-simulator/orderflow-simulator-page";

export default function LabOrderflowSimulatorRoutePage() {
  return (
    <Suspense fallback={<div className="lab-panel p-4 text-sm text-lab-text-muted">Загрузка симулятора…</div>}>
      <OrderflowSimulatorPage />
    </Suspense>
  );
}
