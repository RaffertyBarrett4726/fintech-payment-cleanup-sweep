import { z } from "zod";

export const paymentEvent = z.object({
  paymentId: z.string().min(1),
  objectKey: z.string().min(1),
  settledAt: z.coerce.date(),
  risk: z.enum(["low", "review", "blocked"]),
});
export type PaymentEvent = z.infer<typeof paymentEvent>;

export function decideCleanup(event: PaymentEvent, now: Date, retentionDays = 90): "delete" | "retain" {
  const age = now.getTime() - event.settledAt.getTime();
  const stale = age >= retentionDays * 86_400_000;
  return stale && event.risk === "low" ? "delete" : "retain";
}
