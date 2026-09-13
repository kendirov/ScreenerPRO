import assert from "node:assert/strict";
import { explainAnomaly, qualityFromTimestamp } from "../lib/domain/preparation-market";

const anomaly = explainAnomaly({ change1dPct: 4.2, volatility: 1.2, relativeTurnover: 2.4, rollRatio: .42, dte: 5 });
assert.equal(anomaly.severity, "extreme");
assert.ok(anomaly.reasons.some((reason) => reason.includes("σ")));
assert.ok(anomaly.reasons.some((reason) => reason.includes("оборот")));
assert.equal(qualityFromTimestamp(new Date().toISOString(), true), "LIVE");
assert.equal(qualityFromTimestamp(new Date(Date.now() - 40 * 60_000).toISOString(), true), "STALE");
assert.equal(qualityFromTimestamp(new Date().toISOString(), false), "CLOSED");
console.log("trading preparation contracts: ok");
