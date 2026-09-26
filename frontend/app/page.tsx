"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { missingSections, storySections, type Story } from "./story";

import AuthBoundary from "./auth-boundary";
import StrengthMatrix from "./strength-matrix";
import QuestionBank from "./question-bank";
import PracticeReports from "./practice-reports";
import ResumeImport, { resumeIdentity } from "./resume-import";
import type { BehavioralQuestion } from "./questions";
import {
  LOCAL_STORIES_KEY,
  readLocalStories,
  listStories,
  saveStory,
  deleteStory,
  importLocalStories,
  saveResumeStories,
} from "./story-repository";

const emptyStory = (): Story => ({
  id: crypto.randomUUID(),
  title: "",
  organization: "",
  role: "",
  situation: "",
  task: "",
  actions: "",
  result: "",
  source: "manual",
  updatedAt: "",
});

const subscribeToHydration = () => () => {};

export default function StoryBankPage() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return hydrated ? (
    <AuthBoundary>
      {(user, onNavigateLanding, authActions) => (
        <StoryBank
          key={user?.id ?? "local"}
          ownerId={user?.id}
          userEmail={user?.email}
          onNavigateLanding={onNavigateLanding}
          onSignOut={authActions?.signOut}
          onOpenSignIn={authActions?.openSignIn}
        />
      )}
    </AuthBoundary>
  ) : (
    <main className="bank-main">Loading MeCode…</main>
  );
}

function StoryBank({
  ownerId,
  userEmail,
  onNavigateLanding,
  onSignOut,
  onOpenSignIn,
}: {
  ownerId?: string;
  userEmail?: string | null;
  onNavigateLanding: () => void;
  onSignOut?: () => Promise<void> | void;
  onOpenSignIn?: () => void;
}) {
  const [initial] = useState(() => {
    if (ownerId) return { stories: [] as Story[], error: "" };
    try {
      return { stories: readLocalStories(), error: "" };
    } catch {
      return {
        stories: [] as Story[],
        error: "Browser stories could not be read. Existing data is preserved. Reload after restoring storage access.",
      };
    }
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

  // Resume Modal State
  const [resumeOpen, setResumeOpen] = useState(false);

  // Story List Filter
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    listStories(ownerId)
      .then((loaded) => {
        if (active) {
          setStories(loaded);
          setStorageError("");
        }
      })
      .catch((error) => {
        if (active)
          setStorageError(
            `Could not load cloud stories: ${error.message}. Check your connection and that the database migration has run.`
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [ownerId, reload]);

  const [draft, setDraft] = useState<Story | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const draftId = draft?.id;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (draftId) titleRef.current?.focus();
  }, [draftId]);

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
    if (localStorage.getItem(LOCAL_STORIES_KEY) !== serialized)
      throw new Error("Browser storage failed verification.");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || storageError || busyRef.current) return;
    if (!draft.title.trim()) {
      setSaveError(true);
      setMessage("Give your story a title before saving.");
      titleRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setSaveError(false);
    setMessage("Saving…");
    try {
      const exists = stories.some((story) => story.id === draft.id);
      const saved = ownerId
        ? await saveStory(draft, ownerId, exists)
        : { ...draft, title: draft.title.trim(), updatedAt: new Date().toISOString() };
      const next = exists
        ? stories.map((story) => (story.id === saved.id ? saved : story))
        : [...stories, saved];
      if (!ownerId) persistLocal(next);
      setStories(next);
      setDraft(saved);
      setDirty(false);
      setMessage(
        ownerId
          ? "Story saved to your account in PostgreSQL."
          : "Story saved on this browser only."
      );
    } catch (error) {
      setSaveError(true);
      setMessage(
        `Not saved: ${
          error instanceof Error ? error.message : "Storage unavailable"
        }. Your edits are still here. Try again.`
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !draft ||
      busyRef.current ||
      !window.confirm(
        `Delete “${draft.title}”? This also discards any unsaved edits to this story.`
      )
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      const next = stories.filter((story) => story.id !== draft.id);
      if (ownerId) await deleteStory(draft.id, ownerId);
      else persistLocal(next);
      setStories(next);
      setDraft(null);
      setDirty(false);
      setSaveError(false);
      setMessage("Story deleted.");
    } catch (error) {
      setSaveError(true);
      setMessage(
        `Could not delete: ${error instanceof Error ? error.message : "Storage unavailable"}`
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function importStories() {
    if (!ownerId || busyRef.current) return;
    if (
      !window.confirm(
        "Copy this browser's saved stories into your signed-in account? Existing cloud stories will not be overwritten. Browser copies will be kept."
      )
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      const count = await importLocalStories(ownerId);
      const loaded = await listStories(ownerId);
      setStories(loaded);
      setSaveError(false);
      setMessage(`Imported ${count} new stories. Browser copies were kept.`);
    } catch (error) {
      setSaveError(true);
      setMessage(
        `Import failed: ${
          error instanceof Error ? error.message : "Storage unavailable"
        }. Browser copies were kept; retrying will not duplicate them.`
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function addResumeStories(incoming: Story[]) {
    if (busyRef.current || dirty || !ready || storageError)
      throw new Error("Save the open story and resolve storage errors first");
    busyRef.current = true;
    setBusy(true);
    try {
      const known = new Set(stories.map(resumeIdentity));
      const unique = incoming.filter((story) => {
        const identity = resumeIdentity(story);
        if (known.has(identity)) return false;
        known.add(identity);
        return true;
      });
      const saved = ownerId
        ? await saveResumeStories(unique, ownerId)
        : unique.map((story) => ({
            ...story,
            title: story.title.trim(),
            updatedAt: new Date().toISOString(),
          }));
      const next = [
        ...stories.filter((story) => !saved.some((s) => s.id === story.id)),
        ...saved,
      ];
      if (!ownerId) persistLocal(next);
      setStories(next);
      setResumeOpen(false);
      return saved.length;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function update<K extends keyof Story>(key: K, value: Story[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setDirty(true);
    setMessage("");
  }

  function handleGoHome() {
    if (practiceLocked) return;
    if (dirty && !window.confirm("Discard your unsaved edits?")) return;
    onNavigateLanding();
  }

  function handleCloseDraft() {
    if (dirty && !window.confirm("Discard your unsaved edits?")) return;
    setDraft(null);
    setDirty(false);
    setMessage("");
  }

  const complete = stories.filter((story) => missingSections(story).length === 0).length;
  const exists = draft && stories.some((story) => story.id === draft.id);

  const filteredStories = stories.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.organization.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.situation.toLowerCase().includes(q) ||
      s.actions.toLowerCase().includes(q)
    );
  });

  return (
    <div className="raycast-root workspace-root">
      {/* Background ambient lighting */}
      <div className="raycast-glow-top" aria-hidden="true" />
      <div className="raycast-glow-ambient" aria-hidden="true" />

      {/* Top Navigation Bar */}
      <header className="raycast-nav">
        <div className="raycast-nav-inner">
          <button
            type="button"
            className="raycast-brand raycast-brand-btn"
            onClick={handleGoHome}
            title="Return to MeCode Home"
            aria-label="Return to MeCode Home"
          >
            <span className="raycast-logo-box">
              <span className="raycast-logo-glyph">m.</span>
            </span>
            <span className="raycast-brand-name">MeCode</span>
            <span className="workspace-pill-tag">Workspace</span>
          </button>

          {/* User Status / Account Control */}
          <div className="raycast-nav-actions">
            {userEmail ? (
              <>
                <span className="raycast-user-pill" title={`Signed in as ${userEmail}`}>
                  <span className="pill-status-dot cloud" />
                  {userEmail}
                </span>
                {onSignOut && (
                  <button
                    className="raycast-btn-ghost"
                    onClick={onSignOut}
                    disabled={busy || practiceLocked}
                  >
                    Sign Out
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="raycast-user-pill" title="Saved locally in browser storage">
                  <span className="pill-status-dot demo" />
                  Local Storage
                </span>
                {onOpenSignIn && (
                  <button
                    className="raycast-btn-ghost"
                    onClick={onOpenSignIn}
                  >
                    Sign In to Sync
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="bank-main">
        {/* Workspace Pill Tabs */}
        <div className="workspace-tabs-container">
          <div className="workspace-tabs-bar" role="tablist" aria-label="MeCode workspace">
            {([
              { id: "stories", label: "Stories" },
              { id: "matrix", label: "Strength Matrix" },
              { id: "questions", label: "Question Bank (50)" },
              { id: "reports", label: "Reports" },
            ] as const).map(({ id: tab, label }) => (
              <button
                key={tab}
                id={`${tab}-tab`}
                role="tab"
                className={`workspace-tab-item ${activeTab === tab ? "active" : ""}`}
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
                {tab === "stories" && stories.length > 0 && (
                  <span className="tab-counter-badge">{stories.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <section id="reports-panel" role="tabpanel" aria-labelledby="reports-tab" hidden={activeTab !== "reports"}><PracticeReports refresh={reportRefresh} /></section>
        {/* Question Bank Tab Panel */}
        <section
          id="questions-panel"
          role="tabpanel"
          aria-labelledby="questions-tab"
          hidden={activeTab !== "questions"}
        >
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
                title:
                  question.prompt.length > 55
                    ? `${question.prompt.slice(0, 52)}…`
                    : question.prompt,
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

        {/* Strength Matrix Tab Panel */}
        <section
          id="matrix-panel"
          role="tabpanel"
          aria-labelledby="matrix-tab"
          hidden={activeTab !== "matrix"}
        >
          <StrengthMatrix
            stories={stories}
            ready={ready}
            storageError={storageError}
            dirty={dirty}
            onEdit={(story) => {
              if (dirty && draft?.id !== story.id && !window.confirm("Discard your unsaved edits?"))
                return;
              if (draft?.id !== story.id) {
                setDraft({ ...story });
                setDirty(false);
              }
              setActiveTab("stories");
            }}
          />
        </section>

        {/* Stories Tab Panel */}
        <section
          id="stories-panel"
          role="tabpanel"
          aria-labelledby="stories-tab"
          hidden={activeTab !== "stories"}
        >
          {/* Header Row: Title & The ONLY 2 Story Creation Ways */}
          <div className="page-heading-clean">
            <div className="heading-copy">
              <div className="eyebrow-pill">
                <span className="eyebrow-dot" /> STAR STORY BANK
              </div>
              <h1 className="heading-title">
                Your experience.<br />
                <span>Your next great answer.</span>
              </h1>
              <p className="intro">
                Shape real achievements into structured, memorable STAR interview answers.
              </p>
            </div>

            {/* ONLY TWO WAYS TO CREATE A STORY */}
            <div className="creation-action-pair">
              <button
                type="button"
                className="raycast-btn-ghost pair-btn"
                disabled={!ready || busy || !!storageError || dirty}
                onClick={() => setResumeOpen(true)}
                title="Upload a PDF or paste text to extract STAR stories"
              >
                Import Resume
              </button>
              <button
                type="button"
                className="raycast-btn-glow pair-btn"
                disabled={!ready || busy || !!storageError}
                onClick={() => openStory(emptyStory())}
                title="Start with a blank STAR outline"
              >
                New from Scratch
              </button>
            </div>
          </div>

          {/* Symmetric 3-Stat Glass Grid - Minimalist Typographic */}
          <div className="stats-symmetric">
            <div className="stat-card">
              <span className="stat-card-label">Stories Collected</span>
              <strong className="stat-card-num">{stories.length.toString().padStart(2, "0")}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">STAR Outlines Complete</span>
              <strong className="stat-card-num success">{complete.toString().padStart(2, "0")}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Drafts to Polish</span>
              <strong className="stat-card-num warning">{(stories.length - complete).toString().padStart(2, "0")}</strong>
            </div>
          </div>

          {/* Storage Alert or Local Sync Notification */}
          {storageError && (
            <div role="alert" className="workspace-alert-box error">
              <span>{storageError}</span>
              {ownerId && (
                <button
                  type="button"
                  className="raycast-btn-ghost sm"
                  onClick={() => {
                    setReady(false);
                    setReload((value) => value + 1);
                  }}
                >
                  Retry Connection
                </button>
              )}
            </div>
          )}

          {ownerId && (
            <div className="workspace-alert-box info">
              <span>Found stories saved in your browser storage.</span>
              <button
                type="button"
                className="raycast-btn-ghost sm"
                disabled={busy || !ready || !!storageError || dirty}
                onClick={importStories}
              >
                Import to Cloud Account
              </button>
            </div>
          )}

          {/* Resume Import Modal (Only displayed when open) */}
          <ResumeImport
            stories={stories}
            disabled={!ready || busy || !!storageError || dirty}
            onImport={addResumeStories}
            isOpen={resumeOpen}
            onClose={() => setResumeOpen(false)}
          />

          {/* Symmetrical Two-Column Workspace */}
          <div className="workspace-symmetric">
            {/* Left Column: Story Collection List */}
            <aside className="story-list-symmetric" aria-label="Saved stories">
              <div className="story-list-header">
                <div className="story-list-title-row">
                  <h2>Your Collection</h2>
                  <span className="story-count-tag">{stories.length}</span>
                </div>

                {stories.length > 2 && (
                  <div className="story-search-wrap">
                    <input
                      type="text"
                      className="story-search-input"
                      placeholder="Search stories by keyword…"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                    {searchFilter && (
                      <button
                        type="button"
                        className="story-search-clear"
                        onClick={() => setSearchFilter("")}
                        aria-label="Clear filter"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="story-cards-scroll">
                {!ready ? (
                  <p className="story-list-loading">Loading stories…</p>
                ) : filteredStories.length === 0 ? (
                  <div className="story-list-empty-symmetric">
                    <div className="empty-bar-indicator" />
                    <h3>{stories.length === 0 ? "No stories yet" : "No matching stories"}</h3>
                    <p>
                      {stories.length === 0
                        ? "Choose from scratch or resume on the right to start."
                        : "Try a different search query."}
                    </p>
                  </div>
                ) : (
                  filteredStories.map((story, index) => {
                    const missing = missingSections(story);
                    const isSelected = draft?.id === story.id;
                    return (
                      <button
                        key={story.id}
                        disabled={busy}
                        className={`story-card-item ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          if (isSelected) {
                            handleCloseDraft();
                          } else {
                            openStory(story);
                          }
                        }}
                        aria-pressed={isSelected}
                      >
                        <div className="card-top-line">
                          <span className="card-index-label">
                            Story {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className={`card-status-badge ${missing.length ? "draft" : "filled"}`}>
                            {missing.length ? "Draft" : "Complete"}
                          </span>
                        </div>

                        <h3 className="card-story-title">{story.title || "Untitled Story"}</h3>

                        <p className="card-story-meta">
                          {[story.organization, story.role].filter(Boolean).join(" · ") ||
                            "Personal Experience"}
                        </p>

                        <div className="star-chips-row">
                          {storySections.map(({ key, label }) => {
                            const has = !!story[key]?.trim();
                            const letter = label.charAt(0);
                            return (
                              <span
                                key={key}
                                className={`star-chip ${has ? "has-content" : ""}`}
                                title={`${label}: ${has ? "filled" : "missing"}`}
                              >
                                {letter}
                              </span>
                            );
                          })}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="story-list-footer">
                <span className="sync-dot" />
                <span className="sync-text">
                  {ownerId
                    ? "Private cloud storage (PostgreSQL)"
                    : "Saved in this browser only"}
                </span>
              </div>
            </aside>

            {/* Right Column: Editor or Symmetric Creation Hub */}
            <section className="editor-symmetric" aria-label="Story editor">
              {!draft ? (
                /* Symmetric Welcome & Creation Hub - Minimalist */
                <div className="symmetric-welcome-hub">
                  <div className="welcome-hero-block">
                    <div className="welcome-pill">
                      STAR Framework
                    </div>
                    <h2>You already have the material.</h2>
                    <p>
                      Pick a story from your collection on the left, or create your next answer using
                      one of two ways:
                    </p>
                  </div>

                  <div className="welcome-cards-grid">
                    {/* Option 1: Write from Scratch */}
                    <div
                      className="welcome-card"
                      onClick={() => openStory(emptyStory())}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openStory(emptyStory());
                      }}
                    >
                      <div className="welcome-card-index">01 · MANUAL</div>
                      <h3>Write from Scratch</h3>
                      <p>
                        Start with a clean STAR framework. Shape the Situation, Task, Actions, and
                        Result at your own pace.
                      </p>
                      <span className="welcome-card-btn-text primary">
                        Start blank draft
                      </span>
                    </div>

                    {/* Option 2: Import from Resume */}
                    <div
                      className="welcome-card"
                      onClick={() => setResumeOpen(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setResumeOpen(true);
                      }}
                    >
                      <div className="welcome-card-index">02 · RESUME</div>
                      <h3>Import from Resume</h3>
                      <p>
                        Upload a PDF or paste text. MeCode&apos;s local ML model auto-maps your bullets
                        into structured STAR story drafts.
                      </p>
                      <span className="welcome-card-btn-text secondary">
                        Upload resume
                      </span>
                    </div>
                  </div>

                  <div className="welcome-tip-footer">
                    <span className="tip-bullet-dot" />
                    <span>
                      Focus on concrete actions and measurable outcomes. Leave space to speak naturally in the interview.
                    </span>
                  </div>
                </div>
              ) : (
                /* Active Story Editor */
                <form onSubmit={save} noValidate aria-busy={busy} className="story-editor-form">
                  <fieldset disabled={busy} className="editor-fieldset">
                    <div className="editor-top-heading">
                      <div className="editor-title-group">
                        <button
                          type="button"
                          className="editor-back-btn"
                          onClick={handleCloseDraft}
                          title="Back to Story Overview"
                          aria-label="Back to Story Overview"
                        >
                          Back
                        </button>
                        <div className="editor-title-sub">
                          <span className="editor-eyebrow">
                            {exists ? "EDITING STORY" : "NEW STORY DRAFT"}
                          </span>
                          <h2>Shape your story</h2>
                        </div>
                      </div>
                      <div className="editor-heading-right">
                        <span className={`save-badge-pill ${dirty ? "dirty" : "clean"}`}>
                          {dirty ? "Unsaved edits" : exists ? "Saved" : "New draft"}
                        </span>
                        <button
                          type="button"
                          className="editor-close-btn"
                          onClick={handleCloseDraft}
                          title="Close editor and return to overview"
                          aria-label="Close editor"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    <label className="field-clean">
                      <div className="field-label-row">
                        <span>Story Title</span>
                        <span className="required-tag">Required</span>
                      </div>
                      <input
                        ref={titleRef}
                        value={draft.title}
                        maxLength={160}
                        onChange={(e) => update("title", e.target.value)}
                        placeholder="The time I recovered from a production incident under pressure"
                        aria-invalid={saveError && !draft.title.trim()}
                        aria-describedby="save-feedback"
                        required
                        className="clean-input"
                      />
                    </label>

                    <div className="field-row-symmetric">
                      <label className="field-clean">
                        <span>Organization or Project</span>
                        <input
                          value={draft.organization}
                          onChange={(e) => update("organization", e.target.value)}
                          placeholder="e.g. Acme Labs"
                          className="clean-input"
                        />
                      </label>
                      <label className="field-clean">
                        <span>Your Role</span>
                        <input
                          value={draft.role}
                          onChange={(e) => update("role", e.target.value)}
                          placeholder="e.g. Senior Software Engineer"
                          className="clean-input"
                        />
                      </label>
                    </div>

                    <div className="star-outline-header">
                      <h3>The STAR Outline</h3>
                      <span className="outline-progress">
                        {4 - missingSections(draft).length} of 4 sections filled
                      </span>
                    </div>
                    <p className="outline-tip">
                      {draft.source === "resume" &&
                        "Autofilled from your resume. Review and add any missing context. "}
                      Only describe what truly took place. Drafts can be saved at any stage.
                    </p>

                    <div className="star-sections-stack">
                      {storySections.map(({ key, label, prompt }, index) => {
                        const hasVal = !!draft[key].trim();
                        return (
                          <div className={`star-block ${hasVal ? "filled" : ""}`} key={key}>
                            <div className="star-block-badge">0{index + 1}</div>
                            <div className="star-block-content">
                              <div className="star-block-header">
                                <span className="star-block-title">{label}</span>
                                <span className={`star-status-pill ${hasVal ? "filled" : "to-do"}`}>
                                  {hasVal ? "Filled" : "To develop"}
                                </span>
                              </div>
                              <span className="star-block-prompt">{prompt}</span>
                              <textarea
                                rows={3}
                                value={draft[key]}
                                onChange={(e) => update(key, e.target.value)}
                                placeholder="A few honest bullet points are a great start…"
                                className="clean-textarea"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p
                      id="save-feedback"
                      className={`save-status-line ${saveError ? "error" : ""}`}
                      role={saveError ? "alert" : "status"}
                    >
                      {message ||
                        (ownerId
                          ? "Drafts are stored in PostgreSQL on your account."
                          : "Drafts are stored in this browser only.")}
                    </p>

                    <div className="form-action-footer">
                      <div className="footer-left-buttons">
                        {exists && (
                          <button
                            type="button"
                            className="btn-danger-ghost"
                            disabled={busy || !!storageError}
                            onClick={remove}
                          >
                            Delete Story
                          </button>
                        )}
                        <button
                          type="button"
                          className="raycast-btn-ghost sm"
                          disabled={busy}
                          onClick={handleCloseDraft}
                        >
                          Cancel / Back
                        </button>
                      </div>
                      <button
                        className="raycast-btn-glow"
                        type="submit"
                        disabled={busy || !!storageError}
                      >
                        {busy ? "Saving Story…" : "Save Story"}
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
            </section>
          </div>
        </section>
      </main>

      <footer className="raycast-footer">
        <div className="raycast-footer-inner">
          <div className="raycast-brand">
            <span className="raycast-logo-glyph">m.</span>
            <span>MeCode</span>
          </div>
          <span className="raycast-footer-copy">LeetCode solved technicals. MeCode solves the rest.</span>
          <span className="raycast-footer-tag">HackGT 2026</span>
        </div>
      </footer>
    </div>
  );
}
