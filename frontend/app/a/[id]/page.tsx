import { notFound } from "next/navigation";
import { VisualScene } from "@/components/studio-v6/VisualScene";
import { readSharedLive } from "@/lib/studio-v6/live-remote";
import "@/components/studio-v6/visual-scene.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await readSharedLive();
  const object = state?.overview.objects.find(item => item.id === id);
  return { title: object ? `${object.title} — TQS Studio` : "TQS Studio" };
}

export default async function PublishedArtifactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string; slide?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const state = await readSharedLive();
  const object = state?.overview.objects.find(item => item.id === id && !item.hidden);
  if (!object || (object.kind !== "artifact" && object.kind !== "deck")) notFound();
  const slide = Number(query.slide || 0);
  return (
    <main className={query.embed === "1" ? "vs-publish is-embed" : "vs-publish"} data-testid="published-artifact">
      <VisualScene object={object} publish initialSlide={Number.isFinite(slide) ? slide : 0} />
    </main>
  );
}
