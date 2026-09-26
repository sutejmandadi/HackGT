"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { missingSections, storySections, type Story } from "./story";

import AuthBoundary from "./auth-boundary";
import StrengthMatrix from "./strength-matrix";
import QuestionBank from "./question-bank";
import PracticeReports from "./practice-reports";
import ResumeImport, { resumeIdentity } from "./resume-import";
import type { BehavioralQuestion } from "./questions";
import { LOCAL_STORIES_KEY, readLocalStories, listStories, saveStory, deleteStory, importLocalStories, saveResumeStories } from "./story-repository";
const emptyStory = (): Story => ({
  id: crypto.randomUUID(), title: "", organization: "", role: "",
  situation: "", task: "", actions: "", result: "",
  source: "manual", updatedAt: "",
});

const subscribeToHydration = () => () => {};

export default function StoryBankPage() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return hydrated ? (
    <AuthBoundary>
      {(user, onNavigateLanding) => (
        <StoryBank
          key={user?.id ?? "local"}
          ownerId={user?.id}
          onNavigateLanding={onNavigateLanding}
        />
      )}
    </AuthBoundary>
  ) : (
    <main className="bank-main">Loading MeCode…</main>
  );
}

function StoryBank({
  ownerId,
  onNavigateLanding,
}: {
  ownerId?: string;
  onNavigateLanding: () => void;
}) {
  const [initial] = useState(() => {
    if (ownerId) return { stories: [] as Story[], error: "" };
    try { return { stories: readLocalStories(), error: "" }; }
    catch { return { stories: [] as Story[], error: "Browser stories could not be read. Existing data is preserved. Reload after restoring storage access." }; }
  });
  const [activeTab, setActiveTab] = useState<"stories" | "matrix" | "questions" | "reports">("stories");
  const [practiceLocked, setPracticeLocked] = useState(false);
  const [reportRefresh, setReportRefresh] = useState(0);
  const [stories, setStories] = useState<Story[]>(initial.stories);
  const [ready, setReady] = useState(!ownerId);
  const [storageError, setStorageError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const busyRef = useRef(false);
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    listStories(ownerId).then((loaded) => {
      if (active) { setStories(loaded); setStorageError(""); }
    }).catch((error) => {
      if (active) setStorageError(`Could not load cloud stories: ${error.message}. Check your connection and that the database migration has run.`);
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [ownerId, reload]);
  const [draft, setDraft] = useState<Story | null>(null);
  const [dirty, setDirty] = useState(false);


  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const draftId = draft?.id;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => { if (draftId) titleRef.current?.focus(); }, [draftId]);

  function openStory(story: Story) {
    if (busyRef.current) return;
    if (dirty && !window.confirm("Discard your unsaved edits?")) return;
    setDraft({ ...story });
    setDirty(false);
    setMessage("");
  }

  function persistLocal(next: Story[]) {
    const serialized = JSON.stringify(next);
    localStorage.setItem(LOCAL_STORIES_KEY, serialized);
    if (localStorage.getItem(LOCAL_STORIES_KEY) !== serialized) throw new Error("Browser storage failed verification.");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || storageError || busyRef.current) return;
    if (!draft.title.trim()) { setSaveError(true); setMessage("Give your story a title before saving."); titleRef.current?.focus(); return; }
    busyRef.current = true; setBusy(true); setSaveError(false); setMessage("Saving…");
    try {
      const exists = stories.some((story) => story.id === draft.id);
      const saved = ownerId
        ? await saveStory(draft, ownerId, exists)
        : { ...draft, title: draft.title.trim(), updatedAt: new Date().toISOString() };
      const next = exists ? stories.map((story) => story.id === saved.id ? saved : story) : [...stories, saved];
      if (!ownerId) persistLocal(next);
      setStories(next); setDraft(saved); setDirty(false);
      setMessage(ownerId ? "Story saved to your account in PostgreSQL." : "Story saved on this browser only.");
    } catch (error) {
      setSaveError(true); setMessage(`Not saved: ${error instanceof Error ? error.message : "Storage unavailable"}. Your edits are still here. Try again.`);
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function remove() {
    if (!draft || busyRef.current || !window.confirm(`Delete “${draft.title}”? This also discards any unsaved edits to this story.`)) return;
    busyRef.current = true; setBusy(true);
    try {
      const next = stories.filter((story) => story.id !== draft.id);
      if (ownerId) await deleteStory(draft.id, ownerId); else persistLocal(next);
      setStories(next); setDraft(null); setDirty(false); setSaveError(false); setMessage("Story deleted.");
    } catch (error) { setSaveError(true); setMessage(`Could not delete: ${error instanceof Error ? error.message : "Storage unavailable"}`); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function importStories() {
    if (!ownerId || busyRef.current) return;
    if (!window.confirm("Copy this browser's saved stories into your signed-in account? Existing cloud stories will not be overwritten. Browser copies will be kept.")) return;
    busyRef.current = true; setBusy(true);
    try {
      const count = await importLocalStories(ownerId);
      const loaded = await listStories(ownerId);
      setStories(loaded); setSaveError(false); setMessage(`Imported ${count} new stories. Browser copies were kept.`);
    } catch (error) { setSaveError(true); setMessage(`Import failed: ${error instanceof Error ? error.message : "Storage unavailable"}. Browser copies were kept; retrying will not duplicate them.`); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function addResumeStories(incoming: Story[]) {
    if (busyRef.current || dirty || !ready || storageError) throw new Error("Save the open story and resolve storage errors first");
    busyRef.current = true; setBusy(true);
    try {
      const known = new Set(stories.map(resumeIdentity));
      const unique = incoming.filter((story) => {
        const identity = resumeIdentity(story);
        if (known.has(identity)) return false;
        known.add(identity); return true;
      });
      const saved = ownerId ? await saveResumeStories(unique, ownerId)
        : unique.map((story) => ({ ...story, title: story.title.trim(), updatedAt: new Date().toISOString() }));
      const next = [...stories.filter((story) => !saved.some((s) => s.id === story.id)), ...saved];
      if (!ownerId) persistLocal(next);
      setStories(next);
      return saved.length;
    } finally { busyRef.current = false; setBusy(false); }
  }

  function update<K extends keyof Story>(key: K, value: Story[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value }); setDirty(true); setMessage("");
  }

  function handleGoHome() {
    if (dirty && !window.confirm("Discard your unsaved edits?")) return;
    onNavigateLanding();
  }

  const complete = stories.filter((story) => missingSections(story).length === 0).length;
  const exists = draft && stories.some((story) => story.id === draft.id);

  return (
    <div className="bank-shell">
      <header className="topbar">
        <button
          type="button"
          className="brand brand-btn"
          onClick={handleGoHome}
          title="Return to MeCode landing page"
          aria-label="MeCode Home"
        >
          <span className="brand-icon">m.</span>
          <span>MeCode</span>
        </button>
        <span className="workspace-label">Interview workspace</span>
      </header>
      <main className="bank-main">
        <div className="workspace-tabs" role="tablist" aria-label="MeCode workspace">
          {([
            { id: "stories", label: "Stories" },
            { id: "matrix", label: "Strength matrix" },
            { id: "questions", label: "Question bank (50)" },
            { id: "reports", label: "Reports" },
          ] as const).map(({ id: tab, label }) => (
            <button
              key={tab}
              id={`${tab}-tab`}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tab}-panel`}
              tabIndex={activeTab === tab ? 0 : -1}
              disabled={practiceLocked && tab !== activeTab}
              onClick={() => { if (!practiceLocked) setActiveTab(tab); }}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  if (practiceLocked) return;
                  const tabs = ["stories", "matrix", "questions", "reports"] as const;
                  const cur = tabs.indexOf(activeTab);
                  const next =
                    event.key === "Home"
                      ? tabs[0]
                      : event.key === "End"
                      ? tabs[tabs.length - 1]
                      : event.key === "ArrowRight"
                      ? tabs[(cur + 1) % tabs.length]
                      : tabs[(cur - 1 + tabs.length) % tabs.length];
                  setActiveTab(next);
                  document.getElementById(`${next}-tab`)?.focus();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <section id="reports-panel" role="tabpanel" aria-labelledby="reports-tab" hidden={activeTab !== "reports"}><PracticeReports refresh={reportRefresh} /></section>
        <section id="questions-panel" role="tabpanel" aria-labelledby="questions-tab" hidden={activeTab !== "questions"}>
          <QuestionBank
            onPracticeLockChange={setPracticeLocked}
            onAttemptSaved={() => setReportRefresh(n => n + 1)}
            onReports={() => setActiveTab("reports")}
            stories={stories}
            onOpenStory={(story) => {
              openStory(story);
              setActiveTab("stories");
            }}
            onDraftForQuestion={(question: BehavioralQuestion) => {
              if (dirty && !window.confirm("Discard your unsaved edits?")) return;
              const newDraft: Story = {
                id: crypto.randomUUID(),
                title: question.prompt.length > 55 ? `${question.prompt.slice(0, 52)}…` : question.prompt,
                organization: "",
                role: "",
                situation: `Target interview question: "${question.prompt}"\n\nContext & background:\n`,
                task: "",
                actions: "",
                result: "",
                source: "manual",
                updatedAt: "",
              };
              setDraft(newDraft);
              setDirty(true);
              setMessage("Draft created for interview question. Describe what happened.");
              setActiveTab("stories");
            }}
          />
        </section>
        <section id="matrix-panel" role="tabpanel" aria-labelledby="matrix-tab" hidden={activeTab !== "matrix"}>
          <StrengthMatrix stories={stories} ready={ready} storageError={storageError} dirty={dirty} onEdit={(story) => {
            if (dirty && draft?.id !== story.id && !window.confirm("Discard your unsaved edits?")) return;
            if (draft?.id !== story.id) { setDraft({ ...story }); setDirty(false); }
            setActiveTab("stories");
          }} />
        </section>
        <section id="stories-panel" role="tabpanel" aria-labelledby="stories-tab" hidden={activeTab !== "stories"}>
        <div className="page-heading"><div><p className="eyebrow">Preparation</p><h1>Your experience.<br /><span>Your next great answer.</span></h1><p className="intro">Build a collection of real moments you can draw on in any interview.</p></div><button className="primary" disabled={!ready || busy || !!storageError} onClick={() => openStory(emptyStory())}>+ Add a story</button></div>
        <div className="stats"><div><strong>{stories.length.toString().padStart(2, "0")}</strong><span>Stories collected</span></div><div><strong>{complete.toString().padStart(2, "0")}</strong><span>STAR outlines filled</span></div><div><strong>{(stories.length - complete).toString().padStart(2, "0")}</strong><span>Drafts to develop</span></div><p>Small moments count.<br />A tough decision can be a great story.</p></div>
        {storageError && <div role="alert" className="error">{storageError}{ownerId && <button className="text-button" onClick={() => { setReady(false); setReload((value) => value + 1); }}>Retry connection</button>}</div>}{ownerId && <button className="text-button" disabled={busy || !ready || !!storageError || dirty} onClick={importStories}>Import browser stories</button>}
        <p className="status-message" role="status" aria-live="polite">{!draft ? message : ""}</p>
        <ResumeImport stories={stories} disabled={!ready || busy || !!storageError || dirty} onImport={addResumeStories} />
        <div className="workspace">
          <aside className="story-list" aria-label="Saved stories"><div className="section-heading"><h2>Your collection</h2><span>{stories.length} stories</span></div>
            {!ready ? <p className="muted">Loading your stories…</p> : stories.length === 0 ? <div className="list-empty"><span className="empty-mark">✦</span><h3>Start with one moment</h3><p>A project you built. A problem you solved. A lesson that stayed with you.</p><button className="text-button" disabled={busy || !!storageError} onClick={() => openStory(emptyStory())}>Write your first story →</button></div> : stories.map((story, index) => {
              const missing = missingSections(story);
              return <button disabled={busy} key={story.id} className={`story-card ${draft?.id === story.id ? "selected" : ""}`} onClick={() => openStory(story)} aria-pressed={draft?.id === story.id}>
                <div className="card-meta"><span>Story {String(index + 1).padStart(2, "0")}</span><span className={`badge ${missing.length ? "draft" : "filled"}`}>{missing.length ? "Draft" : "Outline filled"}</span></div><h3>{story.title}</h3><p>{[story.organization, story.role].filter(Boolean).join(" · ") || "Personal experience"}</p><div className="star-indicators">{storySections.map(({ key, label }) => <span key={key} className={story[key].trim() ? "has-content" : ""} title={`${label}: ${story[key].trim() ? "filled" : "missing"}`}>{label === "Actions" ? "Action" : label}</span>)}</div>
              </button>;
            })}
            <p className="storage-note">{ownerId ? "Stored in PostgreSQL and private to your account. Save before switching devices." : "Saved on this browser only. Connect Supabase to access your stories across devices."}</p>
          </aside>
          <section className="editor" aria-label="Story editor">
            {!draft ? <div className="editor-empty"><div className="outline-symbol">S / T / A / R</div><p className="eyebrow">Build your interview stories</p><h2>You already have the material.</h2><p>Pick a story from your collection or add a new one. We&apos;ll help you shape the context, your contribution, and the outcome.</p><button className="primary" disabled={!ready || busy || !!storageError} onClick={() => openStory(emptyStory())}>+ Create a story</button><div className="tip">Think in bullet points, not scripts. Leave space to tell it in your own words.</div></div> :
              <form onSubmit={save} noValidate aria-busy={busy}><fieldset disabled={busy} className="editor-fields"><div className="editor-heading"><div><p className="eyebrow">{exists ? "Edit story" : "New story"}</p><h2>Shape your story</h2></div><span className="save-state">{dirty ? "Unsaved edits" : exists ? "Saved" : "New draft"}</span></div>
                <label className="field">Story title <span className="required">Required</span><input ref={titleRef} value={draft.title} maxLength={160} onChange={(e) => update("title", e.target.value)} placeholder="The time I turned a failing demo around" aria-invalid={saveError && !draft.title.trim()} aria-describedby="save-feedback" required /></label>
                <div className="field-row"><label className="field">Organization or project<input value={draft.organization} onChange={(e) => update("organization", e.target.value)} placeholder="e.g. Robotics club" /></label><label className="field">Your role<input value={draft.role} onChange={(e) => update("role", e.target.value)} placeholder="e.g. Software lead" /></label></div>
                <div className="outline-heading"><h3>The STAR outline</h3><span>{4 - missingSections(draft).length} of 4 sections filled</span></div><p className="outline-help">{draft.source === "resume" && "Autofilled from your resume. Check each section and add the missing context. "}Only write what actually happened. You can save a draft with missing sections.</p>
                {storySections.map(({ key, label, prompt }, index) => <label className="star-field" key={key}><span className="step-number">0{index + 1}</span><span className="star-field-body"><span className="star-label">{label}<span>{draft[key].trim() ? "Filled" : "To develop"}</span></span><span className="field-hint">{prompt}</span><textarea rows={3} value={draft[key]} onChange={(e) => update(key, e.target.value)} placeholder="A few honest bullet points are a good start…" /></span></label>)}
                <p id="save-feedback" className={`save-feedback ${saveError ? "error" : ""}`} role={saveError ? "alert" : "status"}>{message || (ownerId ? "Drafts can be saved with just a title. Stored in your account." : "Drafts can be saved with just a title. Stored in this browser.")}</p><div className="form-footer">{exists ? <button type="button" className="delete-button" disabled={busy || !!storageError} onClick={remove}>Delete story</button> : <span className="muted">Make it yours. Refine it later.</span>}<button className="primary" type="submit" disabled={busy || !!storageError}>{busy ? "Working…" : "Save story"} <span aria-hidden="true">↗</span></button></div>
              </fieldset></form>}
          </section>
        </div>
        </section>
      </main><footer className="page-footer">Good stories start with real experience.</footer>
    </div>
  );
}




