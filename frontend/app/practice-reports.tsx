"use client";

import { useEffect, useState, useMemo } from "react";
import { deleteAttempt, listAttempts } from "./practice-repository";
import { seconds, type Attempt } from "./practice-types";
import InterviewReport from "./interview-report";

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayTooltip(dateStr: string, count: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formatted = dateObj.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (count === 0) return `No practices on ${formatted}`;
  if (count === 1) return `1 practice on ${formatted}`;
  return `${count} practices on ${formatted}`;
}

function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getScorePillClass(score: number): string {
  if (score >= 80) return "strong";
  if (score >= 60) return "moderate";
  return "low";
}

interface MonthGridItemDay {
  type: "day";
  dayNum: number;
  dateKey: string;
  date: Date;
  count: number;
  attempts: Attempt[];
  isToday: boolean;
  isFuture: boolean;
  level: 0 | 1 | 2 | 3 | 4;
}

interface MonthGridItemPad {
  type: "pad";
  key: string;
}

type MonthGridItem = MonthGridItemDay | MonthGridItemPad;

export default function PracticeReports({ refresh }: { refresh: number }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  // Viewed month date
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Selected date on calendar to filter sessions: "YYYY-MM-DD" or null
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Selected attempt to display the full report view: string (attempt.id) or null
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  // Search filter inside practice sessions list
  const [searchQuery, setSearchQuery] = useState("");

  const loading = loaded !== `${refresh}:${retry}`;

  useEffect(() => {
    let active = true;
    listAttempts()
      .then((data) => {
        if (active) {
          setError("");
          setAttempts(data.attempts);
          setTotal(data.total);
          setNext(data.next);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoaded(`${refresh}:${retry}`);
      });
    return () => {
      active = false;
    };
  }, [refresh, retry]);

  async function more() {
    if (!next) return;
    setBusy(true);
    setError("");
    try {
      const data = await listAttempts(next);
      setAttempts((prev) => [
        ...prev,
        ...data.attempts.filter((a) => !prev.some((p) => p.id === a.id)),
      ]);
      setNext(data.next);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more reports.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(attempt: Attempt) {
    if (!window.confirm("Permanently delete this practice attempt, audio transcript, and report?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteAttempt(attempt.id);
      setAttempts((prev) => prev.filter((a) => a.id !== attempt.id));
      if (selectedAttemptId === attempt.id) {
        setSelectedAttemptId(null);
      }
      setTotal((n) => Math.max(0, n - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  function seedSampleHistory() {
    const now = new Date();
    const makeDate = (daysAgo: number, hoursOffset: number = 0) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 14 + hoursOffset, 30);
      return d.toISOString();
    };

    const sampleAttempts: Attempt[] = [
      {
        id: "sample-lead-crisis",
        question_id: "lead-1",
        prompt: "Tell me about a time you led a team through an unexpected crisis.",
        competency: "leadership",
        linked_story_id: null,
        created_at: makeDate(0, -2),
        status: "completed",
        duration: 98,
        is_mock: false,
        pipeline_version: "v1",
        rubric_version: "coaching-3.0",
        error: null,
        transcript: "During our Black Friday launch, our primary database locked up due to an unindexed migration. I immediately convened an emergency response bridge with the infrastructure leads, directed the rollback, and communicated transparently to product stakeholders. Once stabilized, I created pre-deployment schema linters to block future unindexed migrations. We recovered within 18 minutes with zero data loss.",
        metrics: {
          duration: 98,
          total_words: 156,
          wpm: 142,
          speaking_wpm: 152,
          pauses: [{ start: 10, end: 11.5, seconds: 1.5, long: false }],
          ownership: { individual: 5, team: 3 },
          numeric_mentions: 4,
          average_sentence_length: 15,
          longest_monologue: 22,
          redundancy_ratio: 0.1,
          repeated_phrases: [],
          repeated_words: {},
          activity: null,
          star: {
            situation: { words: 28, seconds: 18, percent: 18 },
            task: { words: 24, seconds: 16, percent: 16 },
            actions: { words: 70, seconds: 44, percent: 45 },
            result: { words: 34, seconds: 20, percent: 21 },
            unknown: { words: 0, seconds: 0, percent: 0 },
          },
        },
        analysis: {
          scores: { Overall: 94, Delivery: 92, Structure: 96, Specificity: 95, Relevance: 98, Impact: 89 },
          score_explanation: "Exemplary ownership and structured crisis resolution with concrete metrics.",
          summary: "Outstanding leadership under pressure, crisp STAR transitions, and clear prevention mechanisms.",
          strengths: [
            { kind: "observation", text: "Proactive ownership of rollback and clear stakeholder communication.", segments: [0] },
            { kind: "observation", text: "Concrete measurable impact (18-minute recovery with zero data loss).", segments: [1] },
          ],
          improvements: [
            { kind: "recommendation", text: "Briefly touch upon how team morale was supported post-incident.", segments: [0] },
          ],
          intersections: [
            { kind: "observation", text: "Balanced individual responsibility with collaborative cross-functional delegation.", segments: [0] },
          ],
          exercise: "Practice answering follow-up questions regarding automated chaos testing.",
          outline: [
            { section: "situation", segments: [0], prompt: "Black Friday database lockup" },
            { section: "actions", segments: [0], prompt: "Directed rollback and authored guardrails" },
            { section: "result", segments: [1], prompt: "Restored service in 18 minutes" },
          ],
          confidence: "high",
          limitations: [],
          semantic_method: "SentenceTransformers all-MiniLM-L6-v2",
          intent_assessment: "high",
          ownership_clarity: "exemplary",
          action_depth: "strong",
          result_strength: "strong",
          coherence: "high",
        },
        segments: [
          {
            index: 0,
            start: 0,
            end: 54,
            text: "During our Black Friday launch, our primary database locked up due to an unindexed migration. I immediately convened an emergency response bridge and directed the rollback.",
            star: "actions",
            relevance: 0.95,
            evidence: true,
            vague: false,
            wpm: 144,
          },
          {
            index: 1,
            start: 54,
            end: 98,
            text: "Once stabilized, I created pre-deployment schema linters to block future unindexed migrations. We recovered within 18 minutes with zero data loss.",
            star: "result",
            relevance: 0.98,
            evidence: true,
            vague: false,
            wpm: 140,
          },
        ],
      },
      {
        id: "sample-problem-solving",
        question_id: "ps-1",
        prompt: "Describe a time when you had to optimize system performance under high load.",
        competency: "problem_solving",
        linked_story_id: null,
        created_at: makeDate(0, 1),
        status: "completed",
        duration: 110,
        is_mock: false,
        pipeline_version: "v1",
        rubric_version: "coaching-3.0",
        error: null,
        transcript: "Our payment processing service was dropping 8 percent of webhooks during peak flash sales. I profiled our database query execution plans and discovered synchronous ledger locking. I decoupled the ledger writes by implementing an asynchronous Redis queue with Celery workers and idempotent retry logic. System throughput increased by 400 percent and transaction failure dropped to zero.",
        metrics: {
          duration: 110,
          total_words: 172,
          wpm: 145,
          speaking_wpm: 155,
          pauses: [{ start: 15, end: 16.5, seconds: 1.5, long: false }],
          ownership: { individual: 6, team: 2 },
          numeric_mentions: 5,
          average_sentence_length: 16,
          longest_monologue: 25,
          redundancy_ratio: 0.11,
          repeated_phrases: [],
          repeated_words: {},
          activity: null,
          star: {
            situation: { words: 30, seconds: 20, percent: 18 },
            task: { words: 26, seconds: 18, percent: 16 },
            actions: { words: 78, seconds: 48, percent: 44 },
            result: { words: 38, seconds: 24, percent: 22 },
            unknown: { words: 0, seconds: 0, percent: 0 },
          },
        },
        analysis: {
          scores: { Overall: 91, Delivery: 88, Structure: 94, Specificity: 96, Relevance: 95, Impact: 92 },
          score_explanation: "Thorough technical analysis, great metrics, and clear decoupled architecture explanation.",
          summary: "Clear engineering problem-solving with concrete quantitative impact.",
          strengths: [
            { kind: "observation", text: "Exceptional technical specificity profiling query execution plans.", segments: [0] },
            { kind: "observation", text: "Impressive 400% throughput boost and 0% transaction failure.", segments: [1] },
          ],
          improvements: [
            { kind: "recommendation", text: "Mention how monitoring/alerting was updated for the new Redis queue.", segments: [0] },
          ],
          intersections: [
            { kind: "observation", text: "High technical competence combined with business urgency awareness.", segments: [0] },
          ],
          exercise: "Practice explaining asynchronous worker failure isolation to non-technical interviewers.",
          outline: [
            { section: "situation", segments: [0], prompt: "Payment webhook dropped 8% transactions" },
            { section: "actions", segments: [0], prompt: "Decoupled ledger with Redis queue and Celery" },
            { section: "result", segments: [1], prompt: "Throughput surged 400%, failures dropped to zero" },
          ],
          confidence: "high",
          limitations: [],
          semantic_method: "SentenceTransformers all-MiniLM-L6-v2",
          intent_assessment: "high",
          ownership_clarity: "exemplary",
          action_depth: "strong",
          result_strength: "strong",
          coherence: "high",
        },
        segments: [
          {
            index: 0,
            start: 0,
            end: 62,
            text: "Our payment processing service was dropping 8 percent of webhooks during peak flash sales. I profiled our database query execution plans and discovered synchronous ledger locking. I decoupled the ledger writes by implementing an asynchronous Redis queue.",
            star: "actions",
            relevance: 0.96,
            evidence: true,
            vague: false,
            wpm: 146,
          },
          {
            index: 1,
            start: 62,
            end: 110,
            text: "System throughput increased by 400 percent and transaction failure dropped to zero, preserving over 80k in weekly revenue.",
            star: "result",
            relevance: 0.97,
            evidence: true,
            vague: false,
            wpm: 142,
          },
        ],
      },
      {
        id: "sample-teamwork",
        question_id: "team-1",
        prompt: "Tell me about a time you resolved a major disagreement within your team.",
        competency: "teamwork",
        linked_story_id: null,
        created_at: makeDate(1, 0),
        status: "completed",
        duration: 92,
        is_mock: false,
        pipeline_version: "v1",
        rubric_version: "coaching-3.0",
        error: null,
        transcript: "Our frontend and backend teams were deadlocked between GraphQL and REST for our upcoming mobile rewrite, threatening our launch date. Rather than letting the debate linger, I organized a 90-minute architecture trade-off workshop. We agreed on objective evaluation criteria focusing on client payload latency and team velocity. I proposed a hybrid strategy that allowed us to ship on time with zero regressions.",
        metrics: {
          duration: 92,
          total_words: 148,
          wpm: 144,
          speaking_wpm: 153,
          pauses: [{ start: 11, end: 12.5, seconds: 1.5, long: false }],
          ownership: { individual: 4, team: 4 },
          numeric_mentions: 3,
          average_sentence_length: 15,
          longest_monologue: 21,
          redundancy_ratio: 0.1,
          repeated_phrases: [],
          repeated_words: {},
          activity: null,
          star: {
            situation: { words: 26, seconds: 16, percent: 17 },
            task: { words: 22, seconds: 14, percent: 15 },
            actions: { words: 66, seconds: 42, percent: 46 },
            result: { words: 34, seconds: 20, percent: 22 },
            unknown: { words: 0, seconds: 0, percent: 0 },
          },
        },
        analysis: {
          scores: { Overall: 87, Delivery: 85, Structure: 90, Specificity: 88, Relevance: 92, Impact: 80 },
          score_explanation: "Strong collaborative conflict management with structured framework.",
          summary: "Depersonalized team deadlock through objective metrics and consensus.",
          strengths: [
            { kind: "observation", text: "Framework-driven resolution using shared criteria rather than personal preference.", segments: [0] },
          ],
          improvements: [
            { kind: "recommendation", text: "Quantify the time saved by resolving the dispute early.", segments: [1] },
          ],
          intersections: [
            { kind: "observation", text: "Balanced mediation and decisive leadership.", segments: [0] },
          ],
          exercise: "Practice summarizing the opposing viewpoint with empathy.",
          outline: [
            { section: "situation", segments: [0], prompt: "REST vs GraphQL architectural deadlock" },
            { section: "actions", segments: [0], prompt: "Organized workshop with objective evaluation criteria" },
            { section: "result", segments: [1], prompt: "Reached consensus and shipped on time" },
          ],
          confidence: "high",
          limitations: [],
          semantic_method: "SentenceTransformers all-MiniLM-L6-v2",
          intent_assessment: "high",
          ownership_clarity: "strong",
          action_depth: "strong",
          result_strength: "moderate",
          coherence: "high",
        },
        segments: [
          {
            index: 0,
            start: 0,
            end: 52,
            text: "Our frontend and backend teams were deadlocked between GraphQL and REST for our upcoming mobile rewrite. I organized a 90-minute architecture trade-off workshop focusing on client payload latency.",
            star: "actions",
            relevance: 0.94,
            evidence: true,
            vague: false,
            wpm: 145,
          },
          {
            index: 1,
            start: 52,
            end: 92,
            text: "I proposed a hybrid strategy that allowed us to ship on time with zero regressions, maintaining full alignment across squads.",
            star: "result",
            relevance: 0.96,
            evidence: true,
            vague: false,
            wpm: 141,
          },
        ],
      },
      {
        id: "sample-ambiguity",
        question_id: "amb-1",
        prompt: "Tell me about a time you navigated ambiguity when building a product.",
        competency: "ambiguity",
        linked_story_id: null,
        created_at: makeDate(3, 0),
        status: "completed",
        duration: 95,
        is_mock: false,
        pipeline_version: "v1",
        rubric_version: "coaching-3.0",
        error: null,
        transcript: "We were tasked with integrating AI summarization into our customer support queue, but had zero user research on what agents actually needed. Instead of waiting for a 6-month product spec, I built a prototype in one week and shadow-tested it with 5 senior support specialists. Based on their direct telemetry, we refined the UX, launched 2 months ahead of schedule, and cut average ticket resolution time by 35 percent.",
        metrics: {
          duration: 95,
          total_words: 154,
          wpm: 143,
          speaking_wpm: 153,
          pauses: [{ start: 12, end: 13.5, seconds: 1.5, long: false }],
          ownership: { individual: 5, team: 3 },
          numeric_mentions: 4,
          average_sentence_length: 15,
          longest_monologue: 23,
          redundancy_ratio: 0.1,
          repeated_phrases: [],
          repeated_words: {},
          activity: null,
          star: {
            situation: { words: 28, seconds: 18, percent: 18 },
            task: { words: 24, seconds: 15, percent: 16 },
            actions: { words: 70, seconds: 42, percent: 44 },
            result: { words: 32, seconds: 20, percent: 22 },
            unknown: { words: 0, seconds: 0, percent: 0 },
          },
        },
        analysis: {
          scores: { Overall: 92, Delivery: 90, Structure: 92, Specificity: 94, Relevance: 95, Impact: 89 },
          score_explanation: "Rapid prototyping bias for action in the face of undefined requirements.",
          summary: "Bias for action, customer validation loop, and measurable ticket resolution boost.",
          strengths: [
            { kind: "observation", text: "Proactive customer discovery and rapid prototype testing in 1 week.", segments: [0] },
            { kind: "observation", text: "Measured 35% reduction in support ticket resolution time.", segments: [1] },
          ],
          improvements: [
            { kind: "recommendation", text: "Mention how potential AI hallucination risks were addressed.", segments: [0] },
          ],
          intersections: [
            { kind: "observation", text: "Speed of execution without compromising real user feedback.", segments: [0] },
          ],
          exercise: "Practice discussing edge cases in rapid prototyping.",
          outline: [
            { section: "situation", segments: [0], prompt: "AI summarization project with no spec" },
            { section: "actions", segments: [0], prompt: "Built 1-week spike and shadowed support agents" },
            { section: "result", segments: [1], prompt: "Cut ticket time 35% and shipped 2 months early" },
          ],
          confidence: "high",
          limitations: [],
          semantic_method: "SentenceTransformers all-MiniLM-L6-v2",
          intent_assessment: "high",
          ownership_clarity: "exemplary",
          action_depth: "strong",
          result_strength: "strong",
          coherence: "high",
        },
        segments: [
          {
            index: 0,
            start: 0,
            end: 55,
            text: "We were tasked with integrating AI summarization into our support queue, but had zero user research. I built a prototype in one week and shadow-tested it with 5 support specialists.",
            star: "actions",
            relevance: 0.95,
            evidence: true,
            vague: false,
            wpm: 145,
          },
          {
            index: 1,
            start: 55,
            end: 95,
            text: "Based on their feedback, we refined the UX, launched 2 months ahead of schedule, and cut average ticket resolution time by 35 percent.",
            star: "result",
            relevance: 0.96,
            evidence: true,
            vague: false,
            wpm: 140,
          },
        ],
      },
    ];

    try {
      localStorage.setItem("mecode.practice-attempts.v1", JSON.stringify(sampleAttempts));
      setAttempts(sampleAttempts);
      setTotal(sampleAttempts.length);
    } catch {
      setAttempts(sampleAttempts);
      setTotal(sampleAttempts.length);
    }
  }

  // Monthly calendar data for viewed month
  const { monthDays, currentStreak, maxStreak, monthPracticesCount, monthTitle } = useMemo(() => {
    const today = new Date();
    const todayKey = toDateKey(today);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun, 6 = Sat

    // Map completed attempts by date
    const map = new Map<string, Attempt[]>();
    for (const a of attempts) {
      if (a.status !== "completed") continue;
      const key = toDateKey(new Date(a.created_at));
      const list = map.get(key) || [];
      list.push(a);
      map.set(key, list);
    }

    const gridItems: MonthGridItem[] = [];

    // Prefix padding days before the 1st
    for (let i = 0; i < firstDayOfWeek; i++) {
      gridItems.push({ type: "pad", key: `pad-${i}` });
    }

    let currentMonthTotal = 0;

    // Actual days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const dateKey = toDateKey(cellDate);
      const isToday = dateKey === todayKey;
      const isFuture = cellDate.getTime() > today.getTime() && !isToday;
      const dayAttempts = map.get(dateKey) || [];
      const count = dayAttempts.length;
      currentMonthTotal += count;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count === 1) level = 1;
      else if (count === 2) level = 2;
      else if (count === 3) level = 3;
      else if (count >= 4) level = 4;

      gridItems.push({
        type: "day",
        dayNum: d,
        dateKey,
        date: cellDate,
        count,
        attempts: dayAttempts,
        isToday,
        isFuture,
        level,
      });
    }

    // Streaks calculation across all history
    const sortedDateKeys = Array.from(map.keys()).sort();
    let max = 0;
    let cur = 0;
    for (let i = 0; i < sortedDateKeys.length; i++) {
      if (i === 0) {
        cur = 1;
        max = 1;
      } else {
        const prev = new Date(sortedDateKeys[i - 1] + "T00:00:00");
        const next = new Date(sortedDateKeys[i] + "T00:00:00");
        const diff = Math.round((next.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          cur++;
          if (cur > max) max = cur;
        } else if (diff > 1) {
          cur = 1;
        }
      }
    }

    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const yesterdayKey = toDateKey(yesterday);
    let current = 0;
    const startCheck = map.has(todayKey) ? today : (map.has(yesterdayKey) ? yesterday : null);
    if (startCheck) {
      current = 1;
      const d = new Date(startCheck.getFullYear(), startCheck.getMonth(), startCheck.getDate() - 1);
      while (map.has(toDateKey(d))) {
        current++;
        d.setDate(d.getDate() - 1);
      }
    }

    const title = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    return {
      monthDays: gridItems,
      currentStreak: current,
      maxStreak: Math.max(max, current),
      monthPracticesCount: currentMonthTotal,
      monthTitle: title,
    };
  }, [year, month, attempts, viewDate]);

  // Filtered practices for the sessions list
  const visiblePractices = useMemo(() => {
    let list = attempts;

    // Filter by selected calendar date if any
    if (selectedDate) {
      list = list.filter((a) => toDateKey(new Date(a.created_at)) === selectedDate);
    }

    // Filter by text search if any
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.prompt.toLowerCase().includes(q) ||
          a.competency.toLowerCase().includes(q) ||
          (a.transcript && a.transcript.toLowerCase().includes(q))
      );
    }

    return list;
  }, [attempts, selectedDate, searchQuery]);

  // Active attempt being reviewed in full report mode
  const activeAttempt = attempts.find((a) => a.id === selectedAttemptId);

  // If viewing a full report
  if (activeAttempt) {
    return (
      <div className="reports-workspace">
        <div className="report-full-view">
          <div className="report-view-nav">
            <button
              type="button"
              className="raycast-btn-secondary"
              onClick={() => setSelectedAttemptId(null)}
            >
              ← Back to Calendar & Sessions
            </button>
            <div className="report-view-meta">
              <span className="matrix-cat-badge">
                {activeAttempt.competency.replace(/_/g, " ")}
              </span>
              <span className="muted">
                {new Date(activeAttempt.created_at).toLocaleString()}
              </span>
              {activeAttempt.status === "completed" && (
                <span
                  className={`matrix-score-pill ${getScorePillClass(
                    activeAttempt.analysis.scores.Overall
                  )}`}
                >
                  {Math.round(activeAttempt.analysis.scores.Overall)} / 100
                </span>
              )}
            </div>
            <button
              type="button"
              className="delete-button"
              disabled={busy}
              onClick={() => remove(activeAttempt)}
            >
              Delete attempt
            </button>
          </div>

          <div className="report-view-prompt-card">
            <span className="eyebrow-pill">Interview Question</span>
            <h2>{activeAttempt.prompt}</h2>
            <span className="muted">
              {seconds(activeAttempt.duration)} audio duration · Saved coaching report
            </span>
          </div>

          <InterviewReport key={activeAttempt.id} attempt={activeAttempt} />

          <div className="report-view-bottom-bar">
            <button
              type="button"
              className="raycast-btn-secondary"
              onClick={() => {
                setSelectedAttemptId(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ← Back to Calendar & Sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-workspace">
      {/* Page Heading */}
      <div className="page-heading-clean">
        <div className="page-heading-left">
          <span className="eyebrow-pill">Practice Tracker</span>
          <h1>Practice History & Reports</h1>
          <p className="intro">
            Track your consistency, explore past recordings, and inspect detailed STAR feedback.
          </p>
        </div>
        <div className="page-heading-actions">
          <button
            type="button"
            className="raycast-btn-ghost"
            onClick={seedSampleHistory}
            title="Load 4 sample practice reports to preview the heatmap and report viewer"
          >
            Load Demo History
          </button>
          <button
            className="raycast-btn-ghost"
            disabled={loading || busy}
            onClick={() => setRetry((n) => n + 1)}
          >
            Refresh reports
          </button>
        </div>
      </div>

      {loading && (
        <div className="report-skeleton" role="status">
          Loading saved practice reports…
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button className="text-button" onClick={() => setRetry((n) => n + 1)}>
            Retry reports
          </button>
        </p>
      )}

      {/* Monthly Contribution Calendar */}
      <section className="monthly-calendar-card" aria-label="Monthly practice calendar">
        <div className="monthly-header">
          <div className="monthly-title-group">
            <h2>{monthTitle}</h2>
            <div className="monthly-nav-controls">
              <button
                type="button"
                className="raycast-btn-ghost sm"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                title="Previous month"
                aria-label="Previous month"
              >
                ‹ Prev
              </button>
              <button
                type="button"
                className="raycast-btn-ghost sm"
                onClick={() => setViewDate(new Date())}
                title="Current month"
              >
                This Month
              </button>
              <button
                type="button"
                className="raycast-btn-ghost sm"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                title="Next month"
                aria-label="Next month"
              >
                Next ›
              </button>
            </div>
          </div>

          <div className="monthly-stats-row">
            <span className="monthly-stat-pill flame" title="Consecutive days with at least 1 practice">
              🔥 {currentStreak} Day Streak
            </span>
            <span className="monthly-stat-pill" title="Longest streak of consecutive practice days">
              ⭐ {maxStreak} Longest Streak
            </span>
            <span className="monthly-stat-pill highlight" title="Practices recorded in this month">
              🎯 {monthPracticesCount} in {monthTitle.split(" ")[0]}
            </span>
          </div>
        </div>

        {/* 7-column weekday headers */}
        <div className="monthly-weekdays-grid" aria-hidden="true">
          <span className="monthly-weekday">Sun</span>
          <span className="monthly-weekday">Mon</span>
          <span className="monthly-weekday">Tue</span>
          <span className="monthly-weekday">Wed</span>
          <span className="monthly-weekday">Thu</span>
          <span className="monthly-weekday">Fri</span>
          <span className="monthly-weekday">Sat</span>
        </div>

        {/* 7-column days grid */}
        <div className="monthly-days-grid">
          {monthDays.map((item) => {
            if (item.type === "pad") {
              return <div key={item.key} className="monthly-cell pad" aria-hidden="true" />;
            }

            const isSelected = selectedDate === item.dateKey;
            return (
              <button
                key={item.dateKey}
                type="button"
                className={`monthly-cell level-${item.level} ${
                  item.isToday ? "is-today" : ""
                } ${isSelected ? "is-selected" : ""} ${
                  item.isFuture ? "is-future" : ""
                }`}
                disabled={item.isFuture}
                onClick={() => setSelectedDate(isSelected ? null : item.dateKey)}
                title={formatDayTooltip(item.dateKey, item.count)}
                aria-label={formatDayTooltip(item.dateKey, item.count)}
              >
                <div className="monthly-cell-header">
                  <span className="monthly-cell-day">{item.dayNum}</span>
                  {item.isToday && <span className="monthly-today-dot" title="Today" />}
                </div>

                {item.count > 0 && (
                  <div className="monthly-cell-badge">
                    <span className="monthly-badge-count">{item.count}</span>
                    <span className="monthly-badge-label">
                      {item.count === 1 ? "practice" : "practices"}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Calendar Footer: Selected date filter & color legend */}
        <div className="monthly-footer">
          <div className="monthly-selection-hint">
            {selectedDate ? (
              <>
                <span>
                  Filtering by: <strong>{formatReadableDate(selectedDate)}</strong>
                </span>
                <button
                  type="button"
                  className="monthly-clear-btn"
                  onClick={() => setSelectedDate(null)}
                >
                  Show all days
                </button>
              </>
            ) : (
              <span>Click any date to filter practice sessions</span>
            )}
          </div>

          <div className="monthly-legend" aria-hidden="true">
            <span>Less</span>
            <span className="monthly-legend-cell level-0" title="0 practices" />
            <span className="monthly-legend-cell level-1" title="1 practice" />
            <span className="monthly-legend-cell level-2" title="2 practices" />
            <span className="monthly-legend-cell level-3" title="3 practices" />
            <span className="monthly-legend-cell level-4" title="4+ practices" />
            <span>More</span>
          </div>
        </div>
      </section>

      {/* Practice Sessions Browser List */}
      <section className="practice-sessions-section">
        <div className="practice-section-header">
          <h3>
            {selectedDate
              ? `Practices on ${formatReadableDate(selectedDate)} (${visiblePractices.length})`
              : `All Saved Practices (${visiblePractices.length})`}
          </h3>

          <div className="matrix-search-box">
            <input
              type="text"
              placeholder="Search practices…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="matrix-search-input"
              aria-label="Search saved practice sessions"
            />
          </div>
        </div>

        {visiblePractices.length === 0 ? (
          <div className="list-empty">
            {selectedDate ? (
              <>
                <h2>No practice sessions on this date</h2>
                <p>You did not record an interview response on {formatReadableDate(selectedDate)}.</p>
                <button
                  type="button"
                  className="raycast-btn-secondary"
                  onClick={() => setSelectedDate(null)}
                >
                  Show all practice sessions
                </button>
              </>
            ) : searchQuery ? (
              <>
                <h2>No matching practices found</h2>
                <p>Try searching for a different keyword or competency.</p>
                <button
                  type="button"
                  className="raycast-btn-secondary"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <h2>Your first practice report starts with one answer</h2>
                <p>
                  Open <strong>Question Bank</strong> → choose a prompt → start the <strong>Practice Drill</strong>.
                  Once you analyze your response, your complete audio transcript, scores, and coaching report will be saved here automatically!
                </p>
                <div style={{ marginTop: "16px" }}>
                  <button
                    type="button"
                    className="raycast-btn-glow"
                    onClick={seedSampleHistory}
                  >
                    Load Sample Practice History (Demo)
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="practice-cards-list">
            {visiblePractices.map((attempt) => {
              const isCompleted = attempt.status === "completed";
              const score = isCompleted ? Math.round(attempt.analysis.scores.Overall) : null;
              return (
                <article key={attempt.id} className="practice-card">
                  <div className="practice-card-top">
                    <div className="practice-card-meta">
                      <span className="matrix-cat-badge">
                        {attempt.competency.replace(/_/g, " ")}
                      </span>
                      {score !== null ? (
                        <span className={`matrix-score-pill ${getScorePillClass(score)}`}>
                          {score} / 100
                        </span>
                      ) : (
                        <span className="matrix-score-pill low">
                          {attempt.status.toUpperCase()}
                        </span>
                      )}
                      {attempt.is_mock && (
                        <span className="qb-mock-badge">Sample Report</span>
                      )}
                    </div>

                    <div className="practice-card-info">
                      <span>{new Date(attempt.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      <span>·</span>
                      <span>{seconds(attempt.duration)} duration</span>
                    </div>
                  </div>

                  <h4
                    className="practice-card-prompt"
                    onClick={() => setSelectedAttemptId(attempt.id)}
                    title="Click to open full report"
                  >
                    {attempt.prompt}
                  </h4>

                  <div className="practice-card-bottom">
                    <span className="muted" style={{ fontSize: "12.5px" }}>
                      {attempt.transcript
                        ? `${attempt.transcript.slice(0, 110)}…`
                        : "Click to inspect the complete transcript, MRI segment timeline, and STAR coaching insights."}
                    </span>

                    <div className="practice-card-actions">
                      <button
                        type="button"
                        className="delete-button"
                        disabled={busy}
                        onClick={() => remove(attempt)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="raycast-btn-glow sm"
                        onClick={() => setSelectedAttemptId(attempt.id)}
                      >
                        View Full Report →
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {next !== null && (
          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <button
              className="raycast-btn-secondary"
              disabled={busy}
              onClick={more}
            >
              {busy ? "Loading older attempts…" : `Load older attempts (${total - attempts.length} remaining)`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
