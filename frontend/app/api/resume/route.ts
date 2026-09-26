import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const LIMIT = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url || key) {
    if (!url || !key) return Response.json({ error: "Authentication is not configured correctly." }, { status: 503 });
    const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) return Response.json({ error: "Sign in to import your resume." }, { status: 401 });
    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return Response.json({ error: "Your session expired. Sign in again." }, { status: 401 });
    } catch { return Response.json({ error: "Unable to verify your session. Please retry." }, { status: 503 }); }
  } else if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Configure authentication before enabling resume imports." }, { status: 503 });
  }
  const type = request.headers.get("content-type")?.split(";")[0];
  if (type !== "application/pdf" && type !== "text/plain") return Response.json({ error: "Upload a PDF or UTF-8 text file." }, { status: 415 });
  if (Number(request.headers.get("content-length")) > LIMIT) return Response.json({ error: "Resume exceeds the 5 MB limit." }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Choose a file or paste resume text." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) {
        await reader.cancel();
        return Response.json({ error: "Resume exceeds the 5 MB limit." }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch { return Response.json({ error: "Upload interrupted. Please retry." }, { status: 400 }); }
  finally { reader.releaseLock(); }
  if (!size) return Response.json({ error: "The file or text is empty." }, { status: 400 });
  try {
    const base = process.env.SCORER_API_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${base.replace(/\/$/, "")}/api/resume/parse`, {
      method: "POST", headers: { "Content-Type": type }, body: Buffer.concat(chunks),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]), cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      const safeStatus = [413, 415, 422, 429].includes(response.status);
      return Response.json({ error: safeStatus && typeof data.detail === "string" ? data.detail : "Resume processing failed. Please retry." }, { status: safeStatus ? response.status : 502 });
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Resume service unavailable or timed out. Start the Python backend on port 8000 and try again." }, { status: 503 });
  }
}
