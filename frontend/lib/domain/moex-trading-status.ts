export type MoexSessionStatus = "regular" | "opening" | "auction" | "break" | "closing" | "closed" | "unavailable" | "unknown";

/** MOEX ISS TRADINGSTATUS is a code, not an English status label. */
export function moexTradingStatus(value: unknown): MoexSessionStatus {
  const status = String(value ?? "").trim().toUpperCase();
  if (status === "T") return "regular";
  if (status === "O") return "opening";
  if (status === "F") return "closing";
  if (["I", "S", "A", "a", "b", "p", "P"].includes(String(value ?? "").trim())) return "auction";
  if (status === "B") return "break";
  if (status === "C") return "closed";
  if (status === "N") return "unavailable";
  const text = status.toLowerCase();
  if (text.includes("open") || text.includes("normal")) return "regular";
  if (text.includes("auction")) return "auction";
  if (text.includes("break")) return "break";
  if (text.includes("halt") || text.includes("stop")) return "unavailable";
  if (text.includes("close")) return "closed";
  return "unknown";
}
