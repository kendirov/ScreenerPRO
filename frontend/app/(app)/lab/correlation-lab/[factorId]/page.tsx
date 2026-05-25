import { notFound } from "next/navigation";
import { CorrelationFactorDetailPage } from "@/components/lab/correlation-lab/factor-detail/correlation-factor-detail-page";
import { CORRELATION_API_FACTORS } from "@/lib/domain/correlation-api";
import { normalizeFactorId } from "@/lib/domain/correlation-factor-detail-display";

type PageProps = {
  params: Promise<{ factorId: string }>;
};

export function generateStaticParams() {
  return CORRELATION_API_FACTORS.map((f) => ({ factorId: f.id }));
}

export default async function LabCorrelationFactorRoutePage({ params }: PageProps) {
  const { factorId: raw } = await params;
  const factorId = normalizeFactorId(raw);

  if (!factorId) notFound();

  return (
    <div className="space-y-3">
      <CorrelationFactorDetailPage factorId={factorId} />
    </div>
  );
}
