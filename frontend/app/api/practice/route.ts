export const runtime = "nodejs";
const LIMIT = 12 * 1024 * 1024;
async function proxy(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization");
  if ((url || key) && (!url || !key)) return Response.json({ error: "Authentication is misconfigured." }, { status: 503 });
  if (url && !token?.startsWith("Bearer ")) return Response.json({ error: "Sign in to practice." }, { status: 401 });
  if (!url && process.env.NODE_ENV === "production") return Response.json({ error: "Configure authentication before enabling practice." }, { status: 503 });
  const headers: Record<string,string> = {};
  if (token) headers.Authorization = token;
  let body: ArrayBuffer | undefined;
  if (request.method === "POST") {
    const type = request.headers.get("content-type") || "";
    if (!["audio/webm","audio/mp4","audio/ogg","audio/wav","audio/x-wav","audio/mpeg"].includes(type.split(";")[0])) return Response.json({ error: "Unsupported audio format." }, { status: 415 });
    const meta = request.headers.get("x-practice-meta") || "";
    if (meta.length > 8000) return Response.json({ error: "Question metadata is too large." }, { status: 400 });
    headers["Content-Type"] = type; headers["X-Practice-Meta"] = meta;
    if (Number(request.headers.get("content-length")) > LIMIT) return Response.json({ error: "Recording exceeds 12 MB." }, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "No recording received." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > LIMIT) { await reader.cancel(); return Response.json({ error: "Recording exceeds 12 MB." }, { status: 413 }); }
        chunks.push(value);
      }
    } catch { return Response.json({ error: "Upload interrupted. Your recording is still available." }, { status: 400 }); }
    finally { reader.releaseLock(); }
    body = Uint8Array.from(Buffer.concat(chunks)).buffer;
  }
  const query = new URL(request.url).searchParams;
  const id = query.get("id");
  if (request.method === "DELETE" && !/^[0-9a-f-]{36}$/i.test(id || "")) return Response.json({ error: "Invalid attempt." }, { status: 400 });
  const offset = Math.max(0, Number(query.get("offset")) || 0);
  const suffix = request.method === "DELETE" ? `/${id}` : request.method === "GET" ? query.get("configuration") === "1" ? "/config" : `?offset=${offset}` : "";
  try {
    const upstream = await fetch(`${(process.env.SCORER_API_URL || "http://127.0.0.1:8000").replace(/\/$/,"")}/api/practice${suffix}`, {
      method: request.method, headers, body, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(180000)]),
    });
    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return Response.json({ error: typeof data.detail === "string" ? data.detail : "Practice service failed. Retry shortly." }, { status: upstream.status });
    }
    return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") || "application/json", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch { return Response.json({ error: "Practice service unavailable or timed out. Start the Python backend and retry; your recording is preserved." }, { status: 503 }); }
}
export const POST = proxy;
export const GET = proxy;
export const DELETE = proxy;
