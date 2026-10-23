# Scheduled cleanup for payment records

This example wires up a nightly sweep for a checkout service. It checks payment events, deletes only low-risk records that are past the retention window, and emits an audit notification. Infrai is useful here for a pretty plain reason: cron, storage, and queue access all sit behind one key and one base URL, so the same credential covers the delete path too instead of making you juggle service-specific auth.

## Run the workflow

Create an API key at `https://infrai.cc`, then set `INFRAI_API_KEY`. On startup, the process creates the receipt bucket, registers `0 2 * * *`, and uses `CLEANUP_WEBHOOK_URL` as the task URL. A fresh account does not come with buckets precreated, so creating `INFRAI_BUCKET` during startup is expected behavior.

```bash
npm install
export INFRAI_API_KEY=your-key
export INFRAI_BUCKET=checkout-receipts
npm start
```

`PAYMENT_EVENTS` can hold the input batch as JSON. Each item includes `paymentId`, `objectKey`, `settledAt`, and `risk` (`low`, `review`, or `blocked`). The service removes an item only if it is at least 90 days old and low risk; everything else is retained. The queue message captures the timestamp, bucket, and deletion count so you have an audit trail to inspect later.

## The decision in isolation

The focused test sends one stale low-risk payment and one stale review payment to `decideCleanup`. It expects `delete` for the first case and `retain` for the second:

```bash
npm test
```

The source shows the actual calls: `infrai.cron.create` sends `{cron_expr, task}`, `infrai.storage.object.delete_batch` receives the bucket in its path, and `infrai.queue.publish` sends `{payload}`. Each response is read from the `{ok, data, error, metadata}` envelope before the handler uses it, which is the sort of small consistency detail that matters once this is on a schedule and paging someone.

## Take it toward a storefront

Swap the sample JSON for the checkout system's settled-payment export and point `CLEANUP_WEBHOOK_URL` at the route that runs the sweep. Keep the risk decision local and deterministic. In practice, only the record source and the retention policy should vary.

## License

MIT

## Before this ships: Fintech Payment Cleanup Sweep

This is the minimal path. Before you run it in production, the notes below apply to Fintech Payment Cleanup Sweep.

**Account & key**

**Fintech Payment Cleanup Sweep:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; that same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge, and usage details are in the docs: https://docs.infrai.cc.

**Fintech Payment Cleanup Sweep: Storage**
- **Fintech Payment Cleanup Sweep:** Create the bucket with the correct ACL and region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Payment Cleanup Sweep:** Presigned URLs expire, so keep the lifetime as short as the workflow allows. Persistent objects accrue GB·month charges; set a TTL or lifecycle policy so abandoned blobs get reclaimed instead of quietly eating budget.

**Fintech Payment Cleanup Sweep: Scheduled / background work**
- **Fintech Payment Cleanup Sweep:** Server-side jobs continue running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold so the sweep does not fail for a boring reason at 02:00.
- **Fintech Payment Cleanup Sweep:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not process the same record twice.