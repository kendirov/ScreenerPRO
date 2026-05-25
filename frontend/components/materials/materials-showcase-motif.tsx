import type { MaterialsCardMotif } from "@/lib/materials/showcase-catalog";
import { cn } from "@/lib/utils/cn";

export function MaterialsShowcaseMotif({
  motif,
  className,
}: {
  motif: MaterialsCardMotif;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden opacity-[0.42]",
        className,
      )}
      aria-hidden
    >
      {motif === "bubbles" && <MotifBubbles />}
      {motif === "lines" && <MotifLines />}
      {motif === "orderbook" && <MotifOrderbook />}
      {motif === "timeline" && <MotifTimeline />}
      {motif === "curve" && <MotifCurve />}
      {motif === "grid" && <MotifGrid />}
      {motif === "clusters" && <MotifClusters />}
      {motif === "tape" && <MotifTape />}
      {motif === "futures" && <MotifFutures />}
      {motif === "index" && <MotifIndex />}
    </div>
  );
}

function MotifBubbles() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" preserveAspectRatio="xMaxYMid slice">
      <circle cx="155" cy="35" r="28" fill="rgba(32,231,255,0.12)" />
      <circle cx="175" cy="68" r="18" fill="rgba(139,92,246,0.14)" />
      <circle cx="130" cy="78" r="22" fill="rgba(32,230,164,0.1)" />
      <circle cx="165" cy="95" r="12" fill="rgba(77,124,255,0.12)" />
    </svg>
  );
}

function MotifLines() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" preserveAspectRatio="xMaxYMid slice">
      <path
        d="M20,80 C60,40 90,90 120,50 S170,30 190,60"
        fill="none"
        stroke="rgba(32,231,255,0.35)"
        strokeWidth="2"
      />
      <path
        d="M20,95 C70,70 100,100 140,65 S180,55 190,75"
        fill="none"
        stroke="rgba(139,92,246,0.3)"
        strokeWidth="1.5"
      />
      <path
        d="M20,65 C50,55 110,75 150,45 S175,40 190,50"
        fill="none"
        stroke="rgba(255,200,87,0.25)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

function MotifOrderbook() {
  return (
    <div className="absolute inset-y-3 right-3 flex w-24 flex-col justify-center gap-0.5">
      {[72, 48, 88, 36, 64, 52, 40].map((w, i) => (
        <div key={i} className="flex justify-end gap-1">
          <div
            className="h-2 rounded-sm bg-lab-red/25"
            style={{ width: `${w * 0.45}%` }}
          />
          <div
            className="h-2 w-8 rounded-sm bg-lab-green/20"
            style={{ width: `${100 - w * 0.35}%`, maxWidth: "3rem" }}
          />
        </div>
      ))}
    </div>
  );
}

function MotifTimeline() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
      <line x1="24" y1="60" x2="176" y2="60" stroke="rgba(130,160,255,0.25)" strokeWidth="1" />
      {[40, 80, 120, 160].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="60" r={i === 2 ? 5 : 3.5} fill={i === 2 ? "rgba(32,231,255,0.5)" : "rgba(77,124,255,0.35)"} />
          <rect
            x={x - 8}
            y={72}
            width="16"
            height="3"
            rx="1"
            fill="rgba(130,160,255,0.15)"
          />
        </g>
      ))}
    </svg>
  );
}

function MotifCurve() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" preserveAspectRatio="xMaxYMid slice">
      <path
        d="M30,90 Q80,20 120,55 T190,35"
        fill="none"
        stroke="rgba(32,231,255,0.4)"
        strokeWidth="2.5"
      />
      <path
        d="M30,95 Q90,60 130,70 T190,55"
        fill="none"
        stroke="rgba(139,92,246,0.25)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />
    </svg>
  );
}

function MotifGrid() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(rgba(130,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(130,160,255,0.06) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    />
  );
}

function MotifClusters() {
  return (
    <div className="absolute bottom-3 right-3 grid grid-cols-4 gap-1">
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="h-3 w-3 rounded-sm"
          style={{
            backgroundColor:
              i % 3 === 0
                ? "rgba(32,230,164,0.2)"
                : i % 3 === 1
                  ? "rgba(255,95,122,0.18)"
                  : "rgba(77,124,255,0.12)",
            opacity: 0.4 + (i % 4) * 0.12,
          }}
        />
      ))}
    </div>
  );
}

function MotifTape() {
  return (
    <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
      {[12, 8, 14, 6].map((s, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full",
            i % 2 === 0 ? "bg-lab-green/25" : "bg-lab-red/22",
          )}
          style={{ width: s * 3, height: s * 3 }}
        />
      ))}
    </div>
  );
}

function MotifFutures() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" preserveAspectRatio="xMaxYMid slice">
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={120 + i * 18}
          y={40 + i * 8}
          width="10"
          height={50 - i * 10}
          rx="2"
          fill={`rgba(${i % 2 ? "139,92,246" : "32,231,255"},${0.15 + i * 0.05})`}
        />
      ))}
    </svg>
  );
}

function MotifIndex() {
  return (
    <svg className="h-full w-full" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
      <circle cx="100" cy="60" r="32" fill="none" stroke="rgba(77,124,255,0.2)" strokeWidth="1" />
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x2 = 100 + Math.cos(rad) * 28;
        const y2 = 60 + Math.sin(rad) * 28;
        return (
          <line
            key={deg}
            x1="100"
            y1="60"
            x2={x2}
            y2={y2}
            stroke={`rgba(130,160,255,${0.15 + (i % 3) * 0.08})`}
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}
