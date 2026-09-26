"use client";

import { useEffect, useRef, useState } from "react";
import { cloudConfigured, getSupabase } from "./supabase";
import { missingSections, storySections, type Story } from "./story";

type Candidate = Story & { sourceText: string };
type Parsed = { stories: Omit<Candidate, "id" | "source" | "updatedAt">[]; extractedText: string; warnings: string[]; method: string };
const fields = ["title", "organization", "role", "situation", "task", "actions", "result", "sourceText"] as const;
export function resumeIdentity(story: Pick<Story, "title" | "organization" | "role">) {
  return [story.title, story.organization, story.role].map((v) => v.trim().toLowerCase().replace(/\s+/g, " ")).join("\u0000");
}

export default function ResumeImport({ stories, disabled, onImport }: {
  stories: Story[]; disabled: boolean; onImport: (stories: Story[]) => Promise<number>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [method, setMethod] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!candidates.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [candidates.length]);
  const identities = new Set(stories.map(resumeIdentity));
  const selectable = candidates.filter((candidate) => !identities.has(resumeIdentity(candidate)));
  const picked = selectable.filter((candidate) => selected.has(candidate.id));

  async function extract() {
    if (lock.current || disabled) return;
    if (candidates.length && !window.confirm("Replace the current resume drafts with a new extraction? Your saved stories will stay.")) return;
    setError(""); setMessage("");
    let body: File | string;
    let type: string;
    if (mode === "file") {
      if (!file) { setError("Choose a PDF or text file first."); return; }
      if (!/\.(pdf|txt)$/i.test(file.name)) { setError("Choose a PDF or .txt file, or paste resume text."); return; }
      if (file.size > 5 * 1024 * 1024) { setError("Choose a file smaller than 5 MB."); return; }
      body = file; type = /\.pdf$/i.test(file.name) ? "application/pdf" : "text/plain";
    } else {
      if (!text.trim()) { setError("Paste your resume text first."); return; }
      body = text; type = "text/plain";
    }
    lock.current = true; setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      const headers: Record<string, string> = { "Content-Type": type };
      if (cloudConfigured) {
        const { data, error } = await getSupabase().auth.getSession();
        if (error || !data.session) throw new Error("Sign in again before importing a resume.");
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/resume", { method: "POST", body, headers, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(70000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Resume import failed.");
      const parsed = data as Parsed;
      if (!Array.isArray(parsed.stories) || parsed.stories.length > 40 || !Array.isArray(parsed.warnings) ||
          !parsed.warnings.every((w) => typeof w === "string") || typeof parsed.extractedText !== "string" ||
          parsed.stories.some((s) => !s || fields.some((key) => typeof s[key] !== "string"))) throw new Error("Unexpected resume response. Please retry.");
      const next = parsed.stories.map((s) => ({ ...s, id: crypto.randomUUID(), source: "resume" as const, updatedAt: "" }));
      setCandidates(next); setSelected(new Set(next.filter((s) => !identities.has(resumeIdentity(s))).map((s) => s.id)));
      setText(parsed.extractedText); setWarnings(parsed.warnings); setMethod(parsed.method);
      setMessage(`${next.length} draft ${next.length === 1 ? "story" : "stories"} found. Review and add the ones you want.`);
      setTimeout(() => resultsRef.current?.focus(), 0);
    } catch (err) {
      if (abort.signal.aborted) setMessage("Extraction cancelled. Your previous drafts are still here.");
      else setError(err instanceof Error ? err.message : "Could not extract this resume.");
    } finally { lock.current = false; setBusy(false); controller.current = null; }
  }

  async function add() {
    if (lock.current || !picked.length || disabled) return;
    if (picked.some((s) => !s.title.trim())) { setError("Every selected draft needs a title."); return; }
    lock.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const count = await onImport(picked.map((candidate) => ({
        id: candidate.id, title: candidate.title, organization: candidate.organization, role: candidate.role,
        situation: candidate.situation, task: candidate.task, actions: candidate.actions, result: candidate.result,
        source: candidate.source, updatedAt: candidate.updatedAt,
      })));
      const ids = new Set(picked.map((s) => s.id));
      setCandidates((current) => current.filter((s) => !ids.has(s.id)));
      setSelected(new Set()); setMessage(`Added ${count} ${count === 1 ? "story" : "stories"} to your collection. Open a story below to fill in its missing details.`);
    } catch (err) { setError(`${err instanceof Error ? err.message : "Could not save stories"}. Your drafts are still here; retrying is safe.`); }
    finally { lock.current = false; setSaving(false); }
  }

  function edit(id: string, key: keyof Story, value: string) {
    setCandidates((current) => current.map((s) => s.id === id ? { ...s, [key]: value } : s));
  }

  return <section className="resume-panel" aria-label="Resume import">
    <div className="resume-heading"><div><h2>Start from your resume</h2><p>Turn jobs, projects, and leadership experience into story drafts.</p></div>
      <button className="text-button" aria-expanded={open} aria-controls="resume-content" onClick={() => setOpen(!open)}>{open ? "Hide importer" : candidates.length ? `Review ${candidates.length} resume drafts` : "Import resume"}</button></div>
    <div id="resume-content" hidden={!open}>
      <p className="muted">Processed by MeCode&apos;s local extraction and ML service. The upload is not stored or sent to an external AI provider. Only stories you add are saved.</p>
      <fieldset className="resume-inputs" disabled={busy || saving || disabled}>
        <legend className="sr-only">Resume source</legend>
        <div className="resume-actions"><button type="button" className="text-button" aria-pressed={mode === "file"} onClick={() => setMode("file")}>Upload file</button><button type="button" className="text-button" aria-pressed={mode === "text"} onClick={() => setMode("text")}>Paste text</button></div>
        {mode === "file" ? <label className="field">Resume file<input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><span className="field-hint">Text-based PDF or UTF-8 .txt · up to 5 MB, 10 PDF pages. For scans, paste text after OCR.</span></label> : <label className="field">Resume text<textarea rows={8} maxLength={60000} value={text} onChange={(e) => setText(e.target.value)} placeholder={"WORK EXPERIENCE\nOrganization – Role\n• What you did and achieved\n\nPROJECTS\nProject title\n• Your contribution"} /></label>}
        <button className="primary" type="button" onClick={extract}>{busy ? "Extracting and organizing…" : "Find story drafts"}</button>
      </fieldset>
      {busy && <button className="text-button" onClick={() => controller.current?.abort()}>Cancel extraction</button>}
      {disabled && !saving && <p className="muted">Save your open story and resolve any storage errors before importing.</p>}
      <p role="status" aria-live="polite" className="status-message">{busy ? "Reading your resume and organizing STAR bullets…" : message}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {warnings.map((warning) => <p className="resume-warning" key={warning}>{warning}</p>)}
      {method && <details className="resume-extracted"><summary>Check or correct extracted text</summary><p className="muted">PDF reading order can vary. Use Paste text and Find story drafts again to correct grouping.</p><textarea aria-label="Extracted resume text" rows={8} maxLength={60000} value={text} disabled={busy || saving} onChange={(e) => { setText(e.target.value); setMode("text"); }} /></details>}
      {candidates.length > 0 && <div className="resume-review" aria-busy={saving}>
        <h3 tabIndex={-1} ref={resultsRef}>Review your drafts</h3><p className="muted">{method === "local-ml" ? "Local ML + text rules" : "Text rules"} · Original wording preserved. A bullet can contain both an action and an outcome; adjust its placement as needed. Empty fields need your input.</p>
        <fieldset className="resume-inputs" disabled={busy || saving || disabled}>
          <legend className="sr-only">Draft stories</legend>
          <div className="resume-actions"><button type="button" className="text-button" onClick={() => setSelected(new Set(selectable.map((s) => s.id)))}>Select all new</button><button type="button" className="text-button" onClick={() => setSelected(new Set())}>Select none</button></div>
          {candidates.map((candidate) => {
            const duplicate = identities.has(resumeIdentity(candidate));
            const missing = missingSections(candidate);
            return <article className="resume-candidate" key={candidate.id}>
              <label className="resume-choice"><input type="checkbox" checked={!duplicate && selected.has(candidate.id)} disabled={duplicate} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(candidate.id); else next.delete(candidate.id); return next; })} /><span><strong>{candidate.title || "Untitled story"}</strong><span className="muted">{duplicate ? "Already in your collection (matching title, organization, and role)" : `${missing.length} STAR sections to develop`}</span></span></label>
              <details><summary>Edit draft and view source</summary>
                <div className="resume-draft-grid"><div>
                  <label className="field">Title<input maxLength={160} value={candidate.title} onChange={(e) => edit(candidate.id, "title", e.target.value)} /></label>
                  <div className="field-row"><label className="field">Organization<input value={candidate.organization} onChange={(e) => edit(candidate.id, "organization", e.target.value)} placeholder="Not stated — add if known" /></label><label className="field">Role<input value={candidate.role} onChange={(e) => edit(candidate.id, "role", e.target.value)} placeholder="Not stated — add if known" /></label></div>
                  {storySections.map(({ key, label, prompt }) => <label className="field" key={key}>{label}<span className="field-hint">{prompt}</span><textarea rows={3} value={candidate[key]} onChange={(e) => edit(candidate.id, key, e.target.value)} placeholder="Not in the resume — fill in your experience" /></label>)}
                </div><div className="resume-source"><h4>Original resume entry</h4><p>{candidate.sourceText}</p></div></div>
              </details>
            </article>;
          })}
          <div className="resume-actions"><button className="primary" type="button" disabled={!picked.length} onClick={add}>{saving ? "Adding stories…" : `Add ${picked.length} selected ${picked.length === 1 ? "story" : "stories"}`}</button><button className="text-button" type="button" onClick={() => { if (window.confirm("Discard all remaining resume drafts? Saved stories will stay.")) { setCandidates([]); setSelected(new Set()); } }}>Discard drafts</button></div>
        </fieldset>
      </div>}
    </div>
  </section>;
}
