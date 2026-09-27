"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  BEHAVIORAL_QUESTIONS,
  COMPETENCY_METAS,
  type BehavioralQuestion,
  type CompetencyKey,
} from "./questions";
import type { Story } from "./story";
import PracticeRecorder from "./practice-recorder";

type QuestionStatus = "unpracticed" | "needs_work" | "confident" | "mastered";

interface QuestionBankProps {
  onPracticeLockChange: (locked: boolean) => void;
  onAttemptSaved: () => void;
  onReports: () => void;
  stories: Story[];
  onOpenStory: (story: Story) => void;
  onDraftForQuestion: (question: BehavioralQuestion) => void;
}

const STORAGE_LINKS_KEY = "mecode_question_links";
const STORAGE_STATUS_KEY = "mecode_question_status";
const STORAGE_NOTES_KEY = "mecode_question_notes";

function readStorageMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStorageMap<T>(key: string, data: Record<string, T>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore localStorage write failures (e.g. private browsing quota)
  }
}

const subscribeToHydration = () => () => {};

export default function QuestionBank({
  stories,
  onPracticeLockChange, onAttemptSaved, onReports,
  onOpenStory,
  onDraftForQuestion,
}: QuestionBankProps) {
  const isClient = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [storedLinks, setLinks] = useState<Record<string, string[]>>(() => readStorageMap<string[]>(STORAGE_LINKS_KEY));
  const [statuses, setStatuses] = useState<Record<string, QuestionStatus>>(() => readStorageMap<QuestionStatus>(STORAGE_STATUS_KEY));
  const [notes, setNotes] = useState<Record<string, string>>(() => readStorageMap<string>(STORAGE_NOTES_KEY));

  // Derive visible links without deleting stored data while cloud stories load.
  const links = useMemo(() => {
    const storyIds = new Set(stories.map(story => story.id));
    return Object.fromEntries(Object.entries(storedLinks).map(([questionId, ids]) => [
      questionId,
      Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === "string" && storyIds.has(id)))] : [],
    ]));
  }, [storedLinks, stories]);
  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<CompetencyKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "linked" | "unlinked" | "mastered" | "needs_work">("all");

  const [audioLocked, setAudioLocked] = useState(false);
  const onAudioLock = useCallback((value: boolean) => { setAudioLocked(value); onPracticeLockChange(value); }, [onPracticeLockChange]);

  // Practice Drill Mode state
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showCoachTip, setShowCoachTip] = useState(true);

  // Practice timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);


  function updateStatus(questionId: string, nextStatus: QuestionStatus) {
    setStatuses((prev) => {
      const updated = { ...prev, [questionId]: nextStatus };
      writeStorageMap(STORAGE_STATUS_KEY, updated);
      return updated;
    });
  }

  function cycleStatus(questionId: string) {
    const current = statuses[questionId] || "unpracticed";
    const cycle: Record<QuestionStatus, QuestionStatus> = {
      unpracticed: "needs_work",
      needs_work: "confident",
      confident: "mastered",
      mastered: "unpracticed",
    };
    updateStatus(questionId, cycle[current]);
  }

  function toggleStoryLink(questionId: string, storyId: string) {
    setLinks((prev) => {
      const currentList = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      const updatedList = currentList.includes(storyId)
        ? currentList.filter((id) => id !== storyId)
        : [...currentList, storyId];
      const nextMap = { ...prev, [questionId]: updatedList };
      writeStorageMap(STORAGE_LINKS_KEY, nextMap);
      return nextMap;
    });
  }

  function updateNote(questionId: string, text: string) {
    setNotes((prev) => {
      const updated = { ...prev, [questionId]: text };
      writeStorageMap(STORAGE_NOTES_KEY, updated);
      return updated;
    });
  }

  // Filtered list
  const filteredQuestions = useMemo(() => {
    return BEHAVIORAL_QUESTIONS.filter((q) => {
      if (selectedCategory !== "all" && q.category !== selectedCategory) return false;

      const qLinks = links[q.id] || [];
      const qStatus = statuses[q.id] || "unpracticed";

      if (filterMode === "linked" && qLinks.length === 0) return false;
      if (filterMode === "unlinked" && qLinks.length > 0) return false;
      if (filterMode === "mastered" && qStatus !== "mastered" && qStatus !== "confident") return false;
      if (filterMode === "needs_work" && qStatus !== "needs_work") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesPrompt = q.prompt.toLowerCase().includes(query);
        const matchesTip = q.coachTip.toLowerCase().includes(query);
        const matchesCat = COMPETENCY_METAS[q.category].label.toLowerCase().includes(query);
        return matchesPrompt || matchesTip || matchesCat;
      }

      return true;
    });
  }, [selectedCategory, filterMode, searchQuery, links, statuses]);

  // Overall metrics
  const totalQuestions = BEHAVIORAL_QUESTIONS.length;
  const questionsWithStory = useMemo(() => {
    return BEHAVIORAL_QUESTIONS.filter((q) => (links[q.id] || []).length > 0).length;
  }, [links]);

  const masteredCount = useMemo(() => {
    return BEHAVIORAL_QUESTIONS.filter((q) => statuses[q.id] === "mastered" || statuses[q.id] === "confident").length;
  }, [statuses]);

  // Active question in practice mode
  const practiceQuestion = filteredQuestions[practiceIndex] || filteredQuestions[0] || BEHAVIORAL_QUESTIONS[0];

  function startPractice(index = 0) {
    if (audioLocked) return;
    setPracticeIndex(index);
    setPracticeActive(true);
    setTimerSeconds(0);
    setTimerRunning(false);
  }

  function nextPracticeQuestion() {
    if (audioLocked) return;
    if (practiceIndex < filteredQuestions.length - 1) {
      setPracticeIndex((i) => i + 1);
    } else {
      setPracticeIndex(0);
    }
    setTimerSeconds(0);
    setTimerRunning(false);
  }

  function prevPracticeQuestion() {
    if (audioLocked) return;
    if (practiceIndex > 0) {
      setPracticeIndex((i) => i - 1);
    } else {
      setPracticeIndex(filteredQuestions.length - 1);
    }
    setTimerSeconds(0);
    setTimerRunning(false);
  }

  function randomPracticeQuestion() {
    if (audioLocked) return;
    if (filteredQuestions.length <= 1) return;
    let nextI = practiceIndex;
    while (nextI === practiceIndex) {
      nextI = Math.floor(Math.random() * filteredQuestions.length);
    }
    setPracticeIndex(nextI);
    setTimerSeconds(0);
    setTimerRunning(false);
  }

  // Practice mode keyboard shortcuts (Space=Timer, R=Reset, ArrowRight=Next, ArrowLeft=Prev)
  useEffect(() => {
    if (!practiceActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isInput) return;

      if (e.code === "Space") {
        e.preventDefault();
        setTimerRunning((r) => !r);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setTimerRunning(false);
        setTimerSeconds(0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextPracticeQuestion();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevPracticeQuestion();
      } else if (e.key === "Escape" && !audioLocked) {
        e.preventDefault();
        setPracticeActive(false);
        setTimerRunning(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [practiceActive, practiceIndex, filteredQuestions.length, audioLocked]);

  function formatTimer(totalSec: number) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Timer pacing color
  const timerPaceClass =
    timerSeconds === 0
      ? "timer-idle"
      : timerSeconds <= 120
      ? "timer-green"
      : timerSeconds <= 150
      ? "timer-yellow"
      : "timer-orange";

  return (
    <div className="qb-container">
      {/* Header section */}
      <div className="page-heading-clean">
        <div className="heading-copy">
          <div className="eyebrow-pill">
            <span className="eyebrow-dot" /> 50 CORE PROMPTS & DRILLS
          </div>
          <h1 className="heading-title">
            Behavioral Question Bank.<br />
            <span>Master 50 high-stakes prompts.</span>
          </h1>
          <p className="intro">
            Organized across the 5 core behavioral pillars. Pair questions with your STAR stories and practice timed answers.
          </p>
        </div>
        <div className="qb-header-actions">
          {!practiceActive ? (
            <button className="raycast-btn-glow pair-btn" onClick={() => startPractice(0)}>
              Start Practice Drill
            </button>
          ) : (
            <button className="raycast-btn-ghost sm" disabled={audioLocked} onClick={() => { setPracticeActive(false); setTimerRunning(false); }}>
              Exit Practice Mode
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stats qb-stats">
        <div>
          <strong>{totalQuestions}</strong>
          <span>Core questions</span>
        </div>
        <div>
          <strong>{isClient ? questionsWithStory.toString().padStart(2, "0") : "--"}</strong>
          <span>Covered by a story</span>
        </div>
        <div>
          <strong>{isClient ? masteredCount.toString().padStart(2, "0") : "--"}</strong>
          <span>Confident or mastered</span>
        </div>
        <p>
          Target: 90 to 120 seconds per answer.<br />
          Ground every claim in concrete actions.
        </p>
      </div>

      {/* PRACTICE MODE STAGE */}
      {practiceActive && practiceQuestion && (
        <section className="qb-practice-stage" aria-label="Interactive Practice Stage">
          <div className="qb-practice-top">
            <div className="qb-practice-meta">
              <span
                className="qb-pill"
                style={{
                  borderColor: COMPETENCY_METAS[practiceQuestion.category].color,
                  color: COMPETENCY_METAS[practiceQuestion.category].color,
                }}
              >
                {COMPETENCY_METAS[practiceQuestion.category].label}
              </span>
              <span className="muted">
                Question {practiceIndex + 1} of {filteredQuestions.length}
              </span>
              <span className="shortcut-hint" style={{ fontSize: "11px", marginLeft: "8px" }}>
                <kbd className="qb-hotkey-badge">Space</kbd> Timer • <kbd className="qb-hotkey-badge">R</kbd> Reset • <kbd className="qb-hotkey-badge">→</kbd> Next
              </span>
            </div>
            <div className="qb-timer-block">
              <div className={`qb-timer-display ${timerPaceClass}`}>
                {formatTimer(timerSeconds)}
              </div>
              <button
                className="text-button qb-timer-btn"
                onClick={() => setTimerRunning((r) => !r)}
              >
                {timerRunning ? "Pause" : "Start timer"}
              </button>
              <button
                className="text-button qb-timer-btn"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(0);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="qb-practice-question-box">
            <h2 className="qb-practice-prompt">“{practiceQuestion.prompt}”</h2>
            <div className="qb-practice-subfocus">
              <span className="muted">STAR Focus:</span> <strong>{practiceQuestion.starFocus}</strong>
            </div>
          </div>

          <PracticeRecorder key={practiceQuestion.id} question={practiceQuestion}
            linkedStoryId={(links[practiceQuestion.id] || []).find(id => stories.some(s => s.id === id)) || null}
            onLock={onAudioLock} onSaved={onAttemptSaved} onReports={onReports} />
          {audioLocked && <p className="muted">Stop and analyze or discard your recording before changing questions or tabs.</p>}
          <fieldset disabled={audioLocked} className="qb-practice-grid practice-fieldset">
            {/* Left Column: Framework & Interviewer Tip */}
            <div className="qb-practice-left">
              <div className="qb-card-inner">
                <div className="qb-section-head">
                  <h3>Interviewer Evaluation</h3>
                  <button
                    className="qb-mini-toggle"
                    onClick={() => setShowCoachTip((v) => !v)}
                  >
                    {showCoachTip ? "Hide tips" : "Show tips"}
                  </button>
                </div>
                {showCoachTip && (
                  <p className="qb-coach-tip-text">{practiceQuestion.coachTip}</p>
                )}

                <div className="qb-star-checklist">
                  <h4>Mental STAR Checklist:</h4>
                  <ul>
                    <li>
                      <span className="qb-star-tag s-tag">S</span>
                      <span><strong>Situation:</strong> Concise 2-sentence context with clear stakes.</span>
                    </li>
                    <li>
                      <span className="qb-star-tag t-tag">T</span>
                      <span><strong>Task:</strong> Explicitly state what you personally were accountable for.</span>
                    </li>
                    <li>
                      <span className="qb-star-tag a-tag">A</span>
                      <span><strong>Actions:</strong> 2-3 specific technical or strategic choices you led.</span>
                    </li>
                    <li>
                      <span className="qb-star-tag r-tag">R</span>
                      <span><strong>Result:</strong> Quantified metric, business impact, or lesson learned.</span>
                    </li>
                  </ul>
                </div>

                <div className="qb-status-toggles">
                  <span className="muted">Your readiness:</span>
                  <div className="qb-status-buttons">
                    {(
                      [
                        ["unpracticed", "Unpracticed", ""],
                        ["needs_work", "Needs Work", "status-needs-work"],
                        ["confident", "Confident", "status-confident"],
                        ["mastered", "Mastered", "status-mastered"],
                      ] as const
                    ).map(([val, label, cls]) => {
                      const active = (statuses[practiceQuestion.id] || "unpracticed") === val;
                      return (
                        <button
                          key={val}
                          className={`qb-status-pill ${active ? `active ${cls}` : ""}`}
                          onClick={() => updateStatus(practiceQuestion.id, val)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Scratchpad & Linked Story notes */}
            <div className="qb-practice-right">
              <div className="qb-card-inner">
                <div className="qb-section-head">
                  <h3>Quick Notes & Bullets</h3>
                  <span className="muted">Saved on this device</span>
                </div>
                <textarea
                  className="qb-notes-area"
                  rows={4}
                  value={notes[practiceQuestion.id] || ""}
                  onChange={(e) => updateNote(practiceQuestion.id, e.target.value)}
                  placeholder="Jot down quick bullet points or metric reminders for when you speak..."
                />

                <div className="qb-linked-preview-block">
                  <div className="qb-section-head">
                    <h4>Linked STAR Stories</h4>
                    <button
                      className="text-button qb-mini-btn"
                      onClick={() => onDraftForQuestion(practiceQuestion)}
                    >
                      + Draft new story
                    </button>
                  </div>

                  {(links[practiceQuestion.id] || []).length === 0 ? (
                    <div className="qb-no-links-box">
                      <p className="muted">No story linked to this question yet.</p>
                      {stories.length > 0 && (
                        <div className="qb-link-dropdown-row">
                          <label htmlFor="quick-link-select" className="muted">Link an existing story:</label>
                          <select
                            id="quick-link-select"
                            className="qb-select"
                            onChange={(e) => {
                              if (e.target.value) {
                                toggleStoryLink(practiceQuestion.id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>Choose a story...</option>
                            {stories.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title} ({s.organization || "Personal"})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="qb-linked-stories-list">
                      {(links[practiceQuestion.id] || []).map((sId) => {
                        const story = stories.find((s) => s.id === sId);
                        if (!story) return null;
                        return (
                          <div key={story.id} className="qb-linked-story-card">
                            <div className="qb-linked-story-header">
                              <button
                                className="qb-story-title-link"
                                onClick={() => onOpenStory(story)}
                              >
                                {story.title}
                              </button>
                              <button
                                className="qb-unlink-btn"
                                title="Unlink this story"
                                onClick={() => toggleStoryLink(practiceQuestion.id, story.id)}
                              >
                                Unlink
                              </button>
                            </div>
                            <div className="qb-story-mini-sections">
                              {story.actions && (
                                <p>
                                  <strong>Actions:</strong> {story.actions.slice(0, 160)}
                                  {story.actions.length > 160 ? "…" : ""}
                                </p>
                              )}
                              {story.result && (
                                <p>
                                  <strong>Result:</strong> {story.result.slice(0, 140)}
                                  {story.result.length > 140 ? "…" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </fieldset>

          {/* Navigation Footer */}
          <div className="qb-practice-nav-bar">
            <button className="text-button" disabled={audioLocked} onClick={prevPracticeQuestion}>
              Previous
            </button>
            <div className="qb-practice-nav-center">
              <button className="text-button" disabled={audioLocked} onClick={randomPracticeQuestion}>
                Random Prompt
              </button>
            </div>
            <button className="primary" disabled={audioLocked} onClick={nextPracticeQuestion}>
              Next Question
            </button>
          </div>
        </section>
      )}

      {/* QUESTION BROWSER CONTROLS */}
      <section className="qb-browser-section" aria-label="Question list controls"><fieldset disabled={audioLocked} className="practice-fieldset">
        {/* Category Pills - Sticky Navigation Bar */}
        <div className="qb-sticky-bar">
          <div className="qb-category-tabs" role="tablist" aria-label="Competency filters">
            <button
              className={`qb-cat-pill ${selectedCategory === "all" ? "selected" : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              All Competencies ({BEHAVIORAL_QUESTIONS.length})
            </button>
            {(Object.keys(COMPETENCY_METAS) as CompetencyKey[]).map((catKey) => {
              const meta = COMPETENCY_METAS[catKey];
              const catCount = BEHAVIORAL_QUESTIONS.filter((q) => q.category === catKey).length;
              const isSelected = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  className={`qb-cat-pill ${isSelected ? "selected" : ""}`}
                  style={{
                    borderLeftColor: meta.color,
                  }}
                  onClick={() => setSelectedCategory(catKey)}
                >
                  {meta.shortLabel} ({catCount})
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Secondary Filter Bar */}
        <div className="qb-filter-bar">
          <div className="qb-search-wrapper">
            <input
              type="search"
              className="qb-search-input"
              placeholder="Search by keyword, skill, or theme (e.g., disagreement, debugging, tradeoff)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="qb-filter-select-group">
            <label htmlFor="filter-mode-select" className="muted">Filter:</label>
            <select
              id="filter-mode-select"
              className="qb-select"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as typeof filterMode)}
            >
              <option value="all">All Questions</option>
              <option value="linked">Has Linked Story</option>
              <option value="unlinked">Needs a Story</option>
              <option value="needs_work">Marked “Needs Work”</option>
              <option value="mastered">Confident / Mastered</option>
            </select>
          </div>
        </div>

        {/* Question Cards List */}
        <div className="qb-list-heading">
          <h2>
            {selectedCategory === "all"
              ? "All Questions"
              : COMPETENCY_METAS[selectedCategory].label}
          </h2>
          <span className="muted">
            Showing {filteredQuestions.length} of {totalQuestions} questions
          </span>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="list-empty">
            <h3>No questions found</h3>
            <p>Try clearing your search query or adjusting your filters.</p>
            <button
              className="text-button"
              onClick={() => {
                setSelectedCategory("all");
                setSearchQuery("");
                setFilterMode("all");
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="qb-cards-grid">
            {filteredQuestions.map((question, index) => {
              const meta = COMPETENCY_METAS[question.category];
              const qLinks = links[question.id] || [];
              const status = statuses[question.id] || "unpracticed";
              const noteText = notes[question.id];

              return (
                <div key={question.id} className="qb-question-card">
                  <div className="qb-card-top-row">
                    <div className="qb-badges-wrap">
                      <span
                        className="qb-cat-badge"
                        style={{
                          backgroundColor: `${meta.color}18`,
                          color: meta.color,
                          borderColor: `${meta.color}44`,
                        }}
                      >
                        {meta.shortLabel}
                      </span>
                      <span className="qb-focus-badge">{question.starFocus}</span>
                    </div>
                    <button
                      className={`qb-status-btn status-${status}`}
                      onClick={() => cycleStatus(question.id)}
                      title="Click to cycle readiness status"
                    >
                      {status === "unpracticed" && "Unpracticed"}
                      {status === "needs_work" && "Needs work"}
                      {status === "confident" && "Confident"}
                      {status === "mastered" && "Mastered"}
                    </button>
                  </div>

                  <h3 className="qb-card-prompt">“{question.prompt}”</h3>

                  {noteText && (
                    <div className="qb-card-note-preview">
                      <span className="muted">Note:</span> {noteText}
                    </div>
                  )}

                  {/* Story Linking Section */}
                  <div className="qb-card-links-section">
                    <div className="qb-links-header">
                      <span className="muted">
                        {qLinks.length === 0 ? "No story linked" : `${qLinks.length} ${qLinks.length === 1 ? "story" : "stories"} linked`}
                      </span>
                      <div className="qb-links-actions">
                        {stories.length > 0 && (
                          <select
                            className="qb-mini-select"
                            onChange={(e) => {
                              if (e.target.value) {
                                toggleStoryLink(question.id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            defaultValue=""
                            aria-label="Link a story"
                          >
                            <option value="" disabled>+ Link story…</option>
                            {stories.map((s) => (
                              <option key={s.id} value={s.id}>
                                {qLinks.includes(s.id) ? "• " : ""}{s.title}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          className="text-button qb-mini-action"
                          onClick={() => onDraftForQuestion(question)}
                          title="Draft a new story for this prompt"
                        >
                          + Draft story
                        </button>
                      </div>
                    </div>

                    {qLinks.length > 0 && (
                      <div className="qb-story-chips">
                        {qLinks.map((sId) => {
                          const story = stories.find((s) => s.id === sId);
                          if (!story) return null;
                          return (
                            <span key={story.id} className="qb-story-chip">
                              <button
                                className="qb-chip-name"
                                onClick={() => onOpenStory(story)}
                                title="Open this story in editor"
                              >
                                {story.title}
                              </button>
                              <button
                                className="qb-chip-remove"
                                onClick={() => toggleStoryLink(question.id, story.id)}
                                title="Unlink"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bottom Practice Action */}
                  <div className="qb-card-footer">
                    <button
                      className="primary qb-card-practice-btn"
                      onClick={() => startPractice(index)}
                    >
                      Practice Answering
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </fieldset></section>
    </div>
  );
}
