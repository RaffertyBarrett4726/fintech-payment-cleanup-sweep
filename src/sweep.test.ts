import assert from "node:assert/strict";
import { decideCleanup, paymentEvent } from "./sweep.js";

const now = new Date("2026-09-12T00:00:00Z");
const stale = paymentEvent.parse({ paymentId: "pay_1", objectKey: "receipts/pay_1.json", settledAt: "2026-01-01", risk: "low" });
const risky = { ...stale, paymentId: "pay_2", risk: "review" as const };
assert.equal(decideCleanup(stale, now), "delete");
assert.equal(decideCleanup(risky, now), "retain");
console.log("sweep decision test passed");
