"use client";
import { useRef, useState } from "react";
import { seconds, STAR_KEYS, type Attempt, type Evidence } from "./practice-types";

export default function InterviewReport({attempt,audioUrl}:{attempt:Attempt;audioUrl?:string}){
  const [selected,setSelected]=useState(0);const [expanded,setExpanded]=useState(false);const player=useRef<HTMLAudioElement>(null);
  if(attempt.status!=="completed")return <p role="status">{attempt.status==="failed"?attempt.error||"Analysis failed. Retry your recording in Practice Drill.":"This attempt did not finish yet. If interrupted, retry the original recording or delete this entry."}</p>;
  const {metrics:m,analysis:a,segments}=attempt;const current=segments.find(s=>s.index===selected)||segments[0];
  function focus(index:number){setExpanded(true);setSelected(index);const segment=segments.find(s=>s.index===index);if(player.current&&segment)player.current.currentTime=segment.start;}
  function evidence(item:Evidence,i:number){return <li key={i}>{item.text}<div className="evidence-links">{item.segments.slice(0,8).map(index=>{const s=segments.find(s=>s.index===index);return s?<button key={index} className="text-button" onClick={()=>focus(index)}>{seconds(s.start)} · View passage</button>:null;})}</div></li>;}
  return <div className="interview-report">
    {attempt.is_mock && <p className="resume-warning" role="note">Sample report: this uses example text, not your spoken answer. Scores and pacing are hidden, and this report does not count toward progress.</p>}
    {!attempt.is_mock && <div className="report-score-grid">{Object.entries(a.scores).map(([key,value])=><div key={key}><strong>{Math.round(value)}<small>/100</small></strong><span>{key}</span></div>)}</div>}
    <p className="report-takeaway">{a.summary}</p>
    <details><summary>How scoring works</summary>
      <p>The overall score averages the available categories. A high score needs strong evidence across the answer, not just the right keywords.</p>
      <dl className="report-facts"><dt>Delivery</dt><dd>Steady pace and limited long gaps.</dd><dt>Structure</dt><dd>Clear context and responsibility, with most time on actions and outcomes.</dd><dt>Specificity</dt><dd>Your actions, reasons, checks, and concrete details.</dd><dt>Relevance</dt><dd>How closely the answer relates to the question.</dd><dt>Impact</dt><dd>A clear outcome, supporting detail, and what you learned.</dd></dl>
      <p className="muted">These are coaching estimates, not a prediction of interview success. Automatic labels can be wrong; check the transcript.</p>
      <details><summary>Calculation details for this report</summary><p>{a.score_explanation}</p><p>Rubric: {attempt.rubric_version}. Older reports keep their original scores.</p></details>
    </details>
    <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)} className="response-disclosure"><summary>Transcript and delivery</summary>
    <h3>Answer breakdown</h3><p className="muted">Select a passage to review it. STAR labels are automatic suggestions.</p>
    {audioUrl && <audio controls src={audioUrl} ref={player} aria-label="Play answer with transcript" onTimeUpdate={()=>{const t=player.current?.currentTime||0;const s=segments.find(s=>s.start<=t&&s.end>=t);if(s)setSelected(s.index);}} />}
    <div className="mri-timeline" aria-label="Response segments by time">{segments.map(s=><button key={s.index} className={`mri-segment star-${s.star.charAt(0).toUpperCase()+s.star.slice(1)}`} aria-pressed={current?.index===s.index} style={{flexGrow:Math.max(.1,s.end-s.start)}} onClick={()=>focus(s.index)} title={`${seconds(s.start)}–${seconds(s.end)} · ${s.star.charAt(0).toUpperCase()+s.star.slice(1)} · ${s.wpm} WPM`}><span>{seconds(s.start)}</span><strong>{s.star.charAt(0).toUpperCase()+s.star.slice(1)}</strong><small>{!attempt.is_mock && <>{Math.round(s.wpm)} WPM</>}{s.evidence?" · numeric detail":""}</small></button>)}</div>
    <p className="muted">Timeline widths reflect segment duration; gaps are listed below. S = situation · T = task · A = actions · R = result · unknown = uncertain.</p>
    <div className="evidence-links" aria-label="Pause locations">{m.pauses.map((p,i)=><button key={i} className="text-button" onClick={()=>focus((segments.find(s=>s.start>=p.end)||segments.at(-1))!.index)}>{p.long?"Long gap":"Gap"} {seconds(p.start)} · {p.seconds}s</button>)}</div>
    {!attempt.is_mock && <svg className="pace-chart" viewBox="0 0 640 150" role="img" aria-label="Speaking pace by segment. Exact WPM and timestamps are available in the transcript list below.">
      <line x1="40" y1="120" x2="620" y2="120" stroke="currentColor" /><text x="5" y="15">WPM</text><text x="40" y="145">0:00</text><text x="560" y="145">{seconds(attempt.duration)}</text>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={segments.map(s=>`${40+580*s.start/attempt.duration},${120-100*s.wpm/Math.max(200,...segments.map(x=>x.wpm))}`).join(' ')} />
      {segments.map(s=><circle key={s.index} cx={40+580*s.start/attempt.duration} cy={120-100*s.wpm/Math.max(200,...segments.map(x=>x.wpm))} r="4" fill="var(--accent)"><title>{seconds(s.start)}: {s.wpm} WPM</title></circle>)}
    </svg>}
    {current && <aside className="mri-evidence" aria-live="polite"><h4>{seconds(current.start)}–{seconds(current.end)} · {current.star.charAt(0).toUpperCase()+current.star.slice(1)}{!attempt.is_mock && <> · {current.wpm} WPM</>}</h4><p>“{current.text}”</p><p className="muted">{current.evidence?"Numeric detail cue. ":"No numeric detail cue. "}{current.vague?"Vague-word cue: inspect specificity. ":""}{current.relevance===null?"Relevance unavailable.":`Question similarity ${current.relevance.toFixed(2)} (${current.relevance>=.25?"some semantic overlap":"low overlap; review relevance"}). Not a probability.`}</p></aside>}
    <details><summary>Full synchronized transcript</summary><div className="transcript-list">{segments.map(s=><button className={`transcript-segment ${current?.index===s.index?"selected":""}`} key={s.index} onClick={()=>focus(s.index)}><strong>{seconds(s.start)}–{seconds(s.end)} · {s.star.charAt(0).toUpperCase()+s.star.slice(1)}{!attempt.is_mock && <> · {s.wpm} WPM</>}</strong><span>{s.text}</span></button>)}</div></details>
    </details><div className="report-columns"><section><h3>What worked</h3><ul className="coaching-list">{a.strengths.map(evidence)}</ul></section><section><h3>What to improve</h3><ol className="coaching-list">{a.improvements.map(evidence)}</ol></section></div>
    <details><summary>More coaching details</summary><h3>Delivery and content</h3>{!attempt.is_mock && <ul className="coaching-list">{a.intersections.map(evidence)}</ul>}
    <div className="mri-evidence"><h3>Your next exercise</h3><p>{a.exercise}</p></div>
    <h3>A tighter answer outline</h3><ol>{a.outline.map(o=><li key={o.section}><strong>{o.section.charAt(0).toUpperCase()+o.section.slice(1)}:</strong> {o.prompt} {o.segments.length?`Use segments ${o.segments.map(i=>i+1).join(', ')}.`:"Supply this missing detail yourself."}</li>)}</ol>
    </details><details><summary>Metrics and limitations</summary>
      {!attempt.is_mock && <><dl className="report-facts"><dt>Duration / words / overall pace</dt><dd>{seconds(attempt.duration)} / {m.total_words} / {m.wpm} WPM</dd><dt>Recognized-word speaking pace</dt><dd>{m.speaking_wpm} WPM (excludes gaps)</dd><dt>Average sentence / longest stretch without a ≥1.5s gap</dt><dd>{m.average_sentence_length} words / {m.longest_monologue}s</dd><dt>Numeric mentions / pronouns</dt><dd>{m.numeric_mentions} / I-me-my: {m.ownership.individual}, we-us-our: {m.ownership.team}</dd><dt>Repeated words / phrases</dt><dd>{Object.entries(m.repeated_words).map(([p,c])=>`${p} (${c})`).join(', ')||"None"}; {m.repeated_phrases.map(p=>`${p.phrase} (${p.count})`).join(', ')||"no repeated three-word phrases"}</dd></dl>
      <p>Gaps between recognized words (not a definitive silence measure): {m.pauses.map(p=>`${seconds(p.start)}–${seconds(p.end)}: ${p.seconds}s${p.long?" (long)":""}`).join('; ')||"None ≥1.5s"}.</p>
      {m.activity && <p>Energy estimate: {m.activity.active_seconds}s active / {m.activity.quiet_seconds}s quiet. {m.activity.method}.</p>}
      <ul>{STAR_KEYS.map(k=><li key={k}>{k}: {m.star[k].words} words · {m.star[k].seconds}s · {m.star[k].percent}% of segment time</li>)}</ul>
      </>}<p>{a.ownership_clarity} {a.action_depth} {a.result_strength} {a.coherence} {a.intent_assessment}</p><ul>{a.limitations.map(l=><li key={l}>{l}</li>)}</ul>
    </details>
  </div>;
}
