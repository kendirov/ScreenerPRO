export type MoexSessionStatus = "open" | "auction" | "break" | "closed" | "halted" | "unknown";

/** MOEX ISS TRADINGSTATUS is a code, not an English status label. */
export function moexTradingStatus(value: unknown): MoexSessionStatus {
  const status = String(value ?? "").trim().toUpperCase();
  if (["T", "O"].includes(status)) return "open";
  if (["A", "F"].includes(status)) return "auction";
  if (status === "B") return "break";
  if (["C", "N"].includes(status)) return "closed";
  if (["S", "H"].includes(status)) return "halted";
  const text = status.toLowerCase();
  if (text.includes("open") || text.includes("normal")) return "open";
  if (text.includes("auction")) return "auction";
  if (text.includes("break")) return "break";
  if (text.includes("halt") || text.includes("stop")) return "halted";
  if (text.includes("close")) return "closed";
  return "unknown";
}
