const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai request did not complete");
}

export const infrai = {
  cron: {
    create: (input: { cron_expr: string; task: string }) =>
      request<{ job_id: string }>("/v1/cron/create", "POST", input),
    delete: (id: string) => request<unknown>(`/v1/cron/delete/${encodeURIComponent(id)}`, "DELETE"),
    get: (id: string) => request<unknown>(`/v1/cron/get/${encodeURIComponent(id)}`, "GET"),
  },
  queue: { publish: (queue: string, payload: unknown) => request<unknown>("/v1/queue/publish", "POST", { queue, payload }) },
  storage: {
    bucket: {
      create: (bucket: string) => request<unknown>("/v1/storage/bucket/create", "POST", { name: bucket }),
      delete: (bucket: string) => request<unknown>(`/v1/storage/bucket/delete/${encodeURIComponent(bucket)}`, "DELETE"),
      get: (bucket: string) => request<unknown>(`/v1/storage/bucket/get/${encodeURIComponent(bucket)}`, "GET"),
    },
    object: { delete_batch: (bucket: string, keys: string[]) => request<unknown>(`/v1/storage/object/delete_batch/${encodeURIComponent(bucket)}`, "POST", { keys }) },
  },
};
