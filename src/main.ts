import { infrai } from "./infrai.js";
import { decideCleanup, paymentEvent } from "./sweep.js";

const bucket = process.env.INFRAI_BUCKET ?? "fintech-receipts";
const webhook = process.env.CLEANUP_WEBHOOK_URL ?? "https://example.com/fintech/cleanup";
const now = new Date();

await infrai.storage.bucket.create(bucket);
let jobId: string | undefined;
try {
  const schedule = await infrai.cron.create({ cron_expr: "0 2 * * *", task: webhook });
  jobId = schedule.job_id;
  console.log(`cleanup sweep scheduled as ${jobId}`);

  const rawEvents = JSON.parse(process.env.PAYMENT_EVENTS ?? "[]") as unknown[];
  const events = rawEvents.map((value) => paymentEvent.parse(value));
  const keys = events.filter((event) => decideCleanup(event, now) === "delete").map((event) => event.objectKey);
  if (keys.length) await infrai.storage.object.delete_batch(bucket, keys);
  await infrai.queue.publish("cleanup-audit", JSON.stringify({ kind: "cleanup_audit", at: now.toISOString(), deleted: keys.length, bucket }));
  console.log(`sweep complete: ${keys.length} low-risk stale records removed`);
} finally {
  if (jobId) {
    await infrai.cron.delete(jobId);
    try { await infrai.cron.get(jobId); throw new Error(`cron ${jobId} still exists after deletion`); } catch (error) {
      if (error instanceof Error && error.message.includes("still exists")) throw error;
    }
  }
  await infrai.storage.bucket.delete(bucket);
  try { await infrai.storage.bucket.get(bucket); throw new Error(`bucket ${bucket} still exists after deletion`); } catch (error) {
    if (error instanceof Error && error.message.includes("still exists")) throw error;
  }
}
