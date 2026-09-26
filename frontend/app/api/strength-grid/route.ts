import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url || key) {
    if (!url || !key) return Response.json({ error: "Authentication is not configured correctly." }, { status: 503 });
    const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) return Response.json({ error: "Sign in to analyze your stories." }, { status: 401 });
    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return Response.json({ error: "Your session expired. Sign in again." }, { status: 401 });
    } catch { return Response.json({ error: "Unable to verify your session. Please retry." }, { status: 503 }); }
  } else if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Configure authentication before enabling scoring." }, { status: 503 });
  }
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!Array.isArray(body?.stories) || !body.stories.length || body.stories.length > 100 ||
      body.stories.some((story: Record<string, unknown>) => !story ||
        ["id", "title", "situation", "task", "actions", "result"].some((key) => typeof story[key] !== "string" || (story[key] as string).length > 20000))) {
    return Response.json({ error: "Send 1–100 stories with valid STAR text fields (up to 20,000 characters each)." }, { status: 400 });
  }
  try {
    const base = process.env.SCORER_API_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${base.replace(/\/$/, "")}/api/strength-grid/score-batch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(110000), cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "The scoring service could not analyze these stories. Try again once the model is ready." }, { status: 502 });
    return Response.json(await response.json());
  } catch {
    return Response.json({ error: "Scoring service unavailable. Start the Python backend on port 8000, wait for the model to load, then retry." }, { status: 503 });
  }
}
