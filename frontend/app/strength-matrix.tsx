"use client";

import { useRef, useState } from "react";
import { missingSections, type Story } from "./story";
import { cloudConfigured, getSupabase } from "./supabase";

const categories = [
  ["teamwork", "Teamwork"], ["problem_solving", "Problem solving"],
  ["failure", "Resilience"], ["leadership", "Leadership"], ["ambiguity", "Ambiguity"],
] as const;
type Category = typeof categories[number][0];
type Detail = { level: string; improvement_tip: string; evidence_sentences: string[]; signals_detected: string[] };
type Score = { id: string; title: string; details: Record<Category, Detail> } & Record<Category, number>;
type Result = { scores: Score[]; category_averages: Record<Category, number>; coverage_gaps: string[]; recommended_focus: string };

export default function StrengthMatrix({ stories, ready, storageError, dirty, onEdit }: {
  stories: Story[]; ready: boolean; storageError: string; dirty: boolean; onEdit: (story: Story) => void;
}) {
  const [result, setResult] = useState<{ data: Result; signature: string } | null>(null);
  const [selection, setSelection] = useState<{ id: string; category: Category } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestLock = useRef(false);
  const signature = JSON.stringify(stories);
  const current = result?.signature === signature ? result.data : null;
  const selectedScore = current?.scores.find((score) => score.id === selection?.id);
  const detail = selectedScore && selection ? selectedScore.details[selection.category] : null;

  async function analyze() {
    if (requestLock.current) return;
    requestLock.current = true; setBusy(true); setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cloudConfigured) {
        const { data, error } = await getSupabase().auth.getSession();
        if (error || !data.session) throw new Error("Sign in again before analyzing stories.");
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/strength-grid", { method: "POST", headers,
        body: JSON.stringify({ stories }), signal: AbortSignal.timeout(120000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed. Please try again.");
      if (!Array.isArray(data.scores) || data.scores.length !== stories.length ||
          data.scores.some((score: Score) => !stories.some((story) => story.id === score.id) ||
            categories.some(([key]) => typeof score[key] !== "number" || !Number.isFinite(score[key]) || !score.details?.[key]))) {
        throw new Error("The scorer returned an unexpected response. Please retry.");
      }
      setResult({ data, signature }); setSelection(null);
    } catch (error) {
      setError(error instanceof Error && error.name === "TimeoutError" ? "Scoring timed out. The model may still be loading; try again shortly." : error instanceof Error ? error.message : "Unable to reach the scorer.");
    } finally { setBusy(false); requestLock.current = false; }
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Story coverage</p><h1>Strength matrix</h1><p className="intro">See what each saved story demonstrates across five behavioral competencies.</p></div>
      <button className="primary" disabled={busy || !ready || !!storageError || !stories.length || dirty} onClick={analyze}>{busy ? "Analyzing stories…" : current ? "Refresh analysis" : "Analyze saved stories"}</button></div>
    {dirty && <p className="matrix-notice" role="status">You have unsaved story edits. Return to Stories and save them before analyzing.</p>}
    {storageError && <p role="alert" className="error">Stories could not be loaded. Return to Stories and retry the connection.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {busy && <p role="status" className="matrix-notice">Comparing your stories with the competency rubrics. First-time model loading can take longer.</p>}
    {!ready ? <p role="status">Loading saved stories…</p> : !stories.length ? <div className="editor editor-empty"><h2>Your stories power this matrix</h2><p>Add and save a story in the Stories tab, then return here to analyze it.</p></div> : <>
      {result && !current && <p className="matrix-notice">Your saved stories changed. Run analysis again to update the scores.</p>}
      <p className="muted">Scores are model estimates of evidence strength, not hiring probabilities. Drafts with missing STAR sections may score lower. Select a score to inspect its evidence.</p>
      <div className="matrix-scroll" role="region" aria-label="Story competency scores" tabIndex={0}>
        <table className="matrix-table"><caption>Saved stories × behavioral competencies</caption><thead><tr><th scope="col">Story</th>{categories.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead>
          <tbody>{stories.map((story) => { const score = current?.scores.find((item) => item.id === story.id); const missing = missingSections(story); return <tr key={story.id}><th scope="row"><button className="matrix-story" onClick={() => onEdit(story)}>{story.title}</button><span className="muted">{missing.length ? `${missing.length} STAR sections missing` : "STAR outline filled"}</span></th>{categories.map(([key, label]) => <td key={key}>{score ? <button className={`matrix-score ${score[key] >= 65 ? "strong-score" : score[key] >= 35 ? "moderate-score" : "low-score"}`} aria-label={`${story.title}, ${label}: ${score[key].toFixed(1)} percent. Show evidence`} aria-pressed={selection?.id === story.id && selection.category === key} onClick={() => setSelection({ id: story.id, category: key })}>{score[key].toFixed(1)}%</button> : <span className="muted" aria-label="Not analyzed">—</span>}</td>)}</tr>; })}</tbody>
          {current && <tfoot><tr><th scope="row">Portfolio average</th>{categories.map(([key]) => <td key={key}>{current.category_averages[key].toFixed(1)}%</td>)}</tr></tfoot>}
        </table>
      </div>
      {current && <div className="matrix-summary"><section className="editor"><h2>Coverage gaps</h2><p className="muted">A gap means no saved story reaches the scorer&apos;s 65% threshold for that competency.</p>{current.coverage_gaps.length ? <ul>{current.coverage_gaps.map((key) => <li key={key}>{categories.find(([id]) => id === key)?.[1] || key}</li>)}</ul> : <p>Every competency has at least one story at or above the threshold.</p>}<p className="muted">{current.recommended_focus}</p></section><section className="editor" aria-live="polite"><h2>{selection && selectedScore ? `${categories.find(([key]) => key === selection.category)?.[1]} · ${selectedScore.title}` : "Behind the score"}</h2>{detail ? <><p className="eyebrow">{detail.level}</p><p>{detail.improvement_tip}</p><h3>Evidence from your story</h3>{detail.evidence_sentences.length ? <ul>{detail.evidence_sentences.map((sentence, index) => <li key={index}>{sentence}</li>)}</ul> : <p className="muted">No specific evidence sentence was identified.</p>}{detail.signals_detected.length > 0 && <p className="muted">Detected signals: {detail.signals_detected.join(", ")}</p>}</> : <p className="muted">Select a matrix cell to see the scorer&apos;s evidence and suggestions.</p>}</section></div>}
    </>}
  </>;
}
