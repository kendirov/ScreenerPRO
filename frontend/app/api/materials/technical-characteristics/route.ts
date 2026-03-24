import { NextResponse } from "next/server";
import { getTechnicalCharacteristics } from "@/lib/server/services/materials-technical-characteristics";

function asAssetClass(value: string | null): "all" | "stock" | "future" {
  if (value === "stock" || value === "future") return value;
  return "all";
}

function asLiquid(value: string | null): boolean {
  if (!value) return true;
  return value !== "all";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = asAssetClass(searchParams.get("assetClass"));
  const liquidOnly = asLiquid(searchParams.get("liquidity"));
  try {
    const payload = await getTechnicalCharacteristics({ assetClass, liquidOnly });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load technical characteristics";
    return NextResponse.json(
      {
        rows: [],
        status: {
          source: "demo",
          fetchTimestamp: new Date().toISOString(),
          sourceTimestamp: null,
          rows: 0,
          message: `Данные недоступны: ${message}`,
        },
      },
      { status: 200 },
    );
  }
}
