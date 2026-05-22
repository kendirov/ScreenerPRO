"use client";

import { formatPrice } from "@/lib/formatters/number";
import {
  mergeTeachingAnnotations,
  priceToPercentY,
  TEACHING_COLOR_GLOW,
  TEACHING_COLOR_STROKE,
  type TeachingAnnotation,
} from "@/lib/domain/orderflow-teaching";
import type { ScenarioAnnotation } from "@/lib/domain/orderflow-simulator-engine";
import { cn } from "@/lib/utils/cn";

type TeachingOverlayProps = {
  manualAnnotations: TeachingAnnotation[];
  scenarioAnnotations: ScenarioAnnotation[];
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  presentation?: boolean;
  className?: string;
};

function NeonArrow({
  annotation,
  presentation,
}: {
  annotation: Extract<TeachingAnnotation, { type: "arrow" }>;
  presentation: boolean;
}) {
  const color = annotation.color ?? "cyan";
  const stroke = TEACHING_COLOR_STROKE[color];
  const glow = TEACHING_COLOR_GLOW[color];
  const { from, to } = annotation;
  const markerId = `arrowhead-${annotation.id}`;

  return (
    <g>
      <defs>
        <marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill={stroke} />
        </marker>
      </defs>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={glow}
        strokeWidth={presentation ? 1.8 : 0.9}
        strokeLinecap="round"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={stroke}
        strokeWidth={presentation ? 0.9 : 0.4}
        markerEnd={`url(#${markerId})`}
        strokeLinecap="round"
      />
      <text
        x={(from.x + to.x) / 2}
        y={Math.min(from.y, to.y) - 1.5}
        textAnchor="middle"
        fill={stroke}
        fontSize={presentation ? 4.2 : 2.6}
        className="font-sans"
      >
        {annotation.title}
      </text>
    </g>
  );
}

function PriceLevelMark({
  annotation,
  minPrice,
  maxPrice,
  presentation,
}: {
  annotation: Extract<TeachingAnnotation, { type: "price-level" }>;
  minPrice: number;
  maxPrice: number;
  presentation: boolean;
}) {
  const y = priceToPercentY(annotation.price, minPrice, maxPrice);
  const stroke = TEACHING_COLOR_STROKE[annotation.color];
  const glow = TEACHING_COLOR_GLOW[annotation.color];

  return (
    <g>
      <line x1={4} y1={y} x2={96} y2={y} stroke={glow} strokeWidth={0.35} strokeDasharray="1.5 1.2" />
      <line x1={4} y1={y} x2={96} y2={y} stroke={stroke} strokeWidth={0.2} strokeDasharray="1.5 1.2" />
      {annotation.pulse ? (
        <circle cx={8} cy={y} r={2.2} fill="none" stroke={stroke} strokeWidth={0.25} className="teaching-ring-pulse" />
      ) : null}
      <rect x={72} y={y - (presentation ? 3.5 : 2.8)} width={24} height={presentation ? 7 : 5.6} rx={1} fill="rgba(2,6,23,0.88)" stroke={stroke} strokeWidth={0.15} />
      <text x={86} y={y + (presentation ? 0.8 : 0.5)} fill={stroke} fontSize={presentation ? 2.8 : 2.3} className="font-sans font-medium">
        {formatPrice(annotation.price)}
      </text>
      <text x={86} y={y + (presentation ? 2.8 : 2.2)} fill="rgba(226,232,240,0.75)" fontSize={presentation ? 2.4 : 2} className="font-sans">
        {annotation.title}
      </text>
      {!presentation && annotation.description ? (
        <text x={86} y={y + 3.8} fill="rgba(148,163,184,0.7)" fontSize={1.8} className="font-sans">
          {annotation.description.length > 42 ? `${annotation.description.slice(0, 40)}…` : annotation.description}
        </text>
      ) : null}
    </g>
  );
}

function ZoneMark({
  annotation,
  minPrice,
  maxPrice,
  presentation,
}: {
  annotation: Extract<TeachingAnnotation, { type: "zone" }>;
  minPrice: number;
  maxPrice: number;
  presentation: boolean;
}) {
  const yTop = priceToPercentY(Math.max(annotation.priceFrom, annotation.priceTo), minPrice, maxPrice);
  const yBottom = priceToPercentY(Math.min(annotation.priceFrom, annotation.priceTo), minPrice, maxPrice);
  const color = annotation.color ?? "yellow";
  const stroke = TEACHING_COLOR_STROKE[color];
  const glow = TEACHING_COLOR_GLOW[color];
  const height = Math.max(2, yBottom - yTop);

  return (
    <g>
      <rect x={6} y={yTop} width={58} height={height} fill={glow} stroke={stroke} strokeWidth={0.15} rx={0.8} className="teaching-zone-glow" />
      <text x={8} y={yTop + 2.5} fill={stroke} fontSize={presentation ? 3 : 2.4} className="font-sans font-medium">
        {annotation.title}
      </text>
      {!presentation ? (
        <text x={8} y={yTop + 4.5} fill="rgba(203,213,225,0.75)" fontSize={2} className="font-sans">
          {annotation.description}
        </text>
      ) : null}
    </g>
  );
}

export function TeachingOverlay({
  manualAnnotations,
  scenarioAnnotations,
  currentPrice,
  minPrice,
  maxPrice,
  presentation = false,
  className,
}: TeachingOverlayProps) {
  const annotations = mergeTeachingAnnotations(manualAnnotations, scenarioAnnotations);
  const currentY = priceToPercentY(currentPrice, minPrice, maxPrice);

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10 overflow-hidden", className)} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        {annotations.map((annotation) => {
          if (annotation.type === "arrow") {
            return <NeonArrow key={annotation.id} annotation={annotation} presentation={presentation} />;
          }
          if (annotation.type === "price-level") {
            return (
              <PriceLevelMark
                key={annotation.id}
                annotation={annotation}
                minPrice={minPrice}
                maxPrice={maxPrice}
                presentation={presentation}
              />
            );
          }
          if (annotation.type === "zone") {
            return (
              <ZoneMark
                key={annotation.id}
                annotation={annotation}
                minPrice={minPrice}
                maxPrice={maxPrice}
                presentation={presentation}
              />
            );
          }
          return null;
        })}

        <line x1={4} y1={currentY} x2={96} y2={currentY} stroke="rgba(34,211,238,0.35)" strokeWidth={0.25} strokeDasharray="1 1" />
        <circle cx={95} cy={currentY} r={1.2} fill="rgba(34,211,238,0.9)" className="teaching-price-dot" />
      </svg>
    </div>
  );
}

export type { TeachingAnnotation };
