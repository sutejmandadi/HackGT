"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cloudConfigured, getSupabase } from "./supabase";
import { missingSections, storySections, type Story } from "./story";

type Candidate = Story & { sourceText: string };
type Parsed = { stories: Omit<Candidate, "id" | "source" | "updatedAt">[]; extractedText: string; warnings: string[]; method: string };
const fields = ["title", "organization", "role", "situation", "task", "actions", "result", "sourceText"] as const;
export function resumeIdentity(story: Pick<Story, "title" | "organization" | "role">) {
  return [story.title, story.organization, story.role].map((v) => v.trim().toLowerCase().replace(/\s+/g, " ")).join("\u0000");
}

export default function ResumeImport({
  stories,
  disabled,
  onImport,
  isOpen,
  onClose,
}: {
  stories: Story[];
  disabled: boolean;
  onImport: (stories: Story[]) => Promise<number>;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = useCallback((val: boolean) => {
    if (!val && onClose) onClose();
    else setInternalOpen(val);
  }, [onClose]);
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
  const [isDragging, setIsDragging] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  // Close on Escape when modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);
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

  if (isOpen !== undefined && !open) return null;

  const content = (
    <div className="resume-import-inner">
      <div className="resume-source-toggle">
        <button
          type="button"
          className={`resume-tab-btn ${mode === "file" ? "active" : ""}`}
          onClick={() => setMode("file")}
        >
          Upload PDF / TXT
        </button>
        <button
          type="button"
          className={`resume-tab-btn ${mode === "text" ? "active" : ""}`}
          onClick={() => setMode("text")}
        >
          Paste Resume Text
        </button>
      </div>

      <fieldset className="resume-inputs" disabled={busy || saving || disabled}>
        <legend className="sr-only">Resume source</legend>
        {mode === "file" ? (
          <div
            className={`resume-dropzone ${isDragging ? "drag-active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
          >
            <label className="dropzone-label">
              <span className="dropzone-text">
                {file ? file.name : "Choose or drag a PDF / .txt file here"}
              </span>
              <span className="dropzone-hint">
                Text-based PDF or UTF-8 .txt · up to 5 MB
              </span>
              <input
                type="file"
                className="dropzone-hidden-input"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="dropzone-browse-btn">
                {file ? "Change File" : "Browse File"}
              </span>
            </label>
          </div>
        ) : (
          <label className="field">
            <span className="field-title">Paste Resume Content</span>
            <textarea
              rows={7}
              className="resume-textarea"
              maxLength={60000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"EXPERIENCE\nCompany / Organization — Role\n• Spearheaded cross-functional initiative...\n• Increased system throughput by 40%..."}
            />
          </label>
        )}

        <div className="resume-extract-actions">
          <button
            className="raycast-btn-glow"
            type="button"
            disabled={busy || saving || disabled}
            onClick={extract}
          >
            {busy ? "Analyzing & Generating STAR Drafts…" : "Find Story Drafts"}
          </button>
          {busy && (
            <button
              className="raycast-btn-ghost"
              type="button"
              onClick={() => controller.current?.abort()}
            >
              Cancel
            </button>
          )}
        </div>
      </fieldset>

      {disabled && !saving && (
        <p className="status-subtle">
          Save your open story and resolve any storage errors before importing.
        </p>
      )}

      {message && (
        <div role="status" aria-live="polite" className="resume-status-callout success">
          {message}
        </div>
      )}

      {error && (
        <div className="resume-status-callout error" role="alert">
          {error}
        </div>
      )}

      {warnings.map((warning) => (
        <p className="resume-warning" key={warning}>{warning}</p>
      ))}

      {method && (
        <details className="resume-extracted">
          <summary>View raw extracted text ({method})</summary>
          <textarea
            aria-label="Extracted resume text"
            rows={5}
            maxLength={60000}
            value={text}
            disabled={busy || saving}
            onChange={(e) => { setText(e.target.value); setMode("text"); }}
          />
        </details>
      )}

      {candidates.length > 0 && (
        <div className="resume-review-section" aria-busy={saving}>
          <div className="review-header">
            <div>
              <h3 tabIndex={-1} ref={resultsRef}>Review Discovered Drafts ({candidates.length})</h3>
              <p className="muted">
                {method === "local-ml" ? "Processed via Local ML + STAR heuristics" : "Text heuristics"} · Check the ones you want to add to your collection.
              </p>
            </div>
            <div className="review-select-btns">
              <button
                type="button"
                className="raycast-btn-ghost sm"
                onClick={() => setSelected(new Set(selectable.map((s) => s.id)))}
              >
                Select all new
              </button>
              <button
                type="button"
                className="raycast-btn-ghost sm"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </button>
            </div>
          </div>

          <fieldset className="resume-inputs" disabled={busy || saving || disabled}>
            <div className="candidates-list">
              {candidates.map((candidate) => {
                const duplicate = identities.has(resumeIdentity(candidate));
                const missing = missingSections(candidate);
                const isChecked = !duplicate && selected.has(candidate.id);
                return (
                  <article className={`resume-candidate-card ${isChecked ? "selected" : ""}`} key={candidate.id}>
                    <label className="candidate-select-row">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={duplicate}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(candidate.id);
                            else next.delete(candidate.id);
                            return next;
                          })
                        }
                      />
                      <div className="candidate-info">
                        <h4>{candidate.title || "Untitled draft"}</h4>
                        <span className="candidate-meta">
                          {[candidate.organization, candidate.role].filter(Boolean).join(" · ") || "Experience"}
                          {duplicate ? (
                            <span className="duplicate-tag">Already in collection</span>
                          ) : (
                            <span className="star-tag">{4 - missing.length}/4 STAR sections filled</span>
                          )}
                        </span>
                      </div>
                    </label>

                    <details className="candidate-details">
                      <summary>Edit draft fields & inspect source text</summary>
                      <div className="candidate-edit-grid">
                        <div className="candidate-inputs">
                          <label className="field">
                            Title
                            <input
                              maxLength={160}
                              value={candidate.title}
                              onChange={(e) => edit(candidate.id, "title", e.target.value)}
                            />
                          </label>
                          <div className="field-row">
                            <label className="field">
                              Organization
                              <input
                                value={candidate.organization}
                                onChange={(e) => edit(candidate.id, "organization", e.target.value)}
                                placeholder="e.g. Acme Corp"
                              />
                            </label>
                            <label className="field">
                              Role
                              <input
                                value={candidate.role}
                                onChange={(e) => edit(candidate.id, "role", e.target.value)}
                                placeholder="e.g. Lead Engineer"
                              />
                            </label>
                          </div>
                          {storySections.map(({ key, label, prompt }) => (
                            <label className="field" key={key}>
                              {label}
                              <span className="field-hint">{prompt}</span>
                              <textarea
                                rows={2}
                                value={candidate[key]}
                                onChange={(e) => edit(candidate.id, key, e.target.value)}
                                placeholder="Not detected in resume — fill in details"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="candidate-source-box">
                          <h5>Original resume text</h5>
                          <p>{candidate.sourceText}</p>
                        </div>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>

            <div className="resume-commit-bar">
              <button
                className="raycast-btn-glow"
                type="button"
                disabled={!picked.length || saving}
                onClick={add}
              >
                {saving ? "Adding Stories…" : `Add ${picked.length} Selected ${picked.length === 1 ? "Story" : "Stories"}`}
              </button>
              <button
                className="raycast-btn-ghost"
                type="button"
                onClick={() => {
                  if (window.confirm("Discard all resume drafts? Your existing stories are safe.")) {
                    setCandidates([]);
                    setSelected(new Set());
                  }
                }}
              >
                Discard drafts
              </button>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );

  if (isOpen !== undefined) {
    return (
      <div className="raycast-modal-backdrop" onClick={() => setOpen(false)}>
        <div
          className="raycast-modal-window resume-modal-window"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-modal-title"
        >
          <button
            className="raycast-modal-close"
            onClick={() => setOpen(false)}
            aria-label="Close modal"
          >
            Close
          </button>

          <div className="raycast-modal-header">
            <h2 id="resume-modal-title">Import from Resume</h2>
            <p className="raycast-modal-sub">
              Upload a PDF or paste resume text. MeCode maps your achievements directly to STAR outlines.
            </p>
          </div>

          {content}
        </div>
      </div>
    );
  }

  return (
    <section className="resume-panel" aria-label="Resume import">
      <div className="resume-heading">
        <div>
          <h2>Start from your resume</h2>
          <p>Turn jobs, projects, and leadership experience into story drafts.</p>
        </div>
        <button
          className="text-button"
          aria-expanded={open}
          aria-controls="resume-content"
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide importer" : candidates.length ? `Review ${candidates.length} resume drafts` : "Import resume"}
        </button>
      </div>
      <div id="resume-content" hidden={!open}>
        {content}
      </div>
    </section>
  );
}
