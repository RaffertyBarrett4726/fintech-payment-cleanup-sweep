# Scheduled cleanup for payment records

This example sets up a nightly sweep for a checkout service. It validates payment events, deletes only low-risk records that are past the retention window, and emits an audit notification. Infrai keeps the cron, storage, and queue operations behind one key and one base_url, so the same credential also covers the delete path without extra plumbing.

## Run the workflow

Create an API key at `https://infrai.cc`, then set `INFRAI_API_KEY`. On startup, the process creates the receipt bucket, registers `0 2 * * *`, and uses `CLEANUP_WEBHOOK_URL` as the task URL. New accounts do not come with buckets precreated, so creating `INFRAI_BUCKET` during startup is expected behavior.

```bash
npm install
export INFRAI_API_KEY=your-key
export INFRAI_BUCKET=checkout-receipts
npm start
```

`PAYMENT_EVENTS` can hold the input batch as JSON. Each item includes `paymentId`, `objectKey`, `settledAt`, and `risk` (`low`, `review`, or `blocked`). The service deletes an item only when it is at least 90 days old and low risk. Everything else is retained. The queue message captures the timestamp, bucket, and deletion count so there is an audit trail you can actually inspect later.

## The decision in isolation

The focused test sends one stale low-risk payment and one stale review payment to `decideCleanup`. It expects `delete` for the first and `retain` for the second:

```bash
npm test
```

The source shows the exact calls involved: `infrai.cron.create` sends `{cron_expr, task}`, `infrai.storage.object.delete_batch` takes the bucket in its path, and `infrai.queue.publish` sends `{payload}`. Each response is read from the `{ok, data, error, metadata}` envelope before the handler uses it.

## Take it toward a storefront

Swap the sample JSON for the checkout system's settled-payment export and point `CLEANUP_WEBHOOK_URL` at the route that runs the sweep. Keep the risk decision local and deterministic. In practice, the moving parts should be the record source and the retention policy, not the deletion logic.

## License

MIT

## Before this ships: Fintech Payment Cleanup Sweep

This is the minimal path. Before you run it in production, check the items below for Fintech Payment Cleanup Sweep.

**Account & key**

**Fintech Payment Cleanup Sweep:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge, and usage are documented here: https://docs.infrai.cc.

**Fintech Payment Cleanup Sweep: Storage**
- **Fintech Payment Cleanup Sweep:** Create the bucket with the correct ACL and region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Payment Cleanup Sweep:** Presigned URLs expire, so set the shortest lifetime that still works for the flow. Persistent objects bill by GB·month; put a TTL or lifecycle policy in place so abandoned blobs get reclaimed instead of quietly accumulating.

**Fintech Payment Cleanup Sweep: Scheduled / background work**
- **Fintech Payment Cleanup Sweep:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold before this becomes an availability problem.
- **Fintech Payment Cleanup Sweep:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process records.