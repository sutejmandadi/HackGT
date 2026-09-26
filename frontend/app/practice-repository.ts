import { cloudConfigured, getSupabase } from "./supabase";
import { currentReport, isAttempt, type Attempt } from "./practice-types";
const KEY = "mecode.practice-attempts.v1";
export async function practiceHeaders(): Promise<Record<string,string>> {
  if (!cloudConfigured) return {};
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw new Error("Sign in again to access practice reports.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}
function localAttempts(): Attempt[] {
  const data: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
  if (!Array.isArray(data) || !data.every(isAttempt)) throw new Error("Local reports could not be read. Existing data is preserved.");
  return data.map(currentReport);
}
export function saveLocalAttempt(attempt: Attempt) {
  if (cloudConfigured) throw new Error("Local fallback is disabled in cloud mode.");
  const next = [attempt,...localAttempts().filter(a => a.id !== attempt.id)];
  localStorage.setItem(KEY, JSON.stringify(next));
}
export async function listAttempts(offset=0): Promise<{ attempts: Attempt[]; total: number; next: number | null }> {
  if (!cloudConfigured) { const all=localAttempts(); return {attempts:all.slice(offset,offset+50),total:all.length,next:all.length>offset+50?offset+50:null}; }
  const res=await fetch(`/api/practice?offset=${offset}`,{ headers: await practiceHeaders(), cache:"no-store" });
  const data=await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load reports.");
  if (!Array.isArray(data.attempts) || !data.attempts.every(isAttempt)) throw new Error("Unexpected report data. Please retry.");
  return {...data,attempts:data.attempts.map(currentReport)};
}
export async function deleteAttempt(id: string) {
  if (!cloudConfigured) { localStorage.setItem(KEY,JSON.stringify(localAttempts().filter(a=>a.id!==id))); return; }
  const res=await fetch(`/api/practice?id=${id}`,{method:"DELETE",headers:await practiceHeaders()});
  if (!res.ok) { const data=await res.json(); throw new Error(data.error || "Could not delete attempt."); }
}
