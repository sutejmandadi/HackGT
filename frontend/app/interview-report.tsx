"use client";
import { useRef, useState } from "react";
import { seconds, STAR_KEYS, type Attempt, type Evidence } from "./practice-types";

export default function InterviewReport({attempt,audioUrl}:{attempt:Attempt;audioUrl?:string}){
  const [selected,setSelected]=useState(0);const player=useRef<HTMLAudioElement>(null);
  if(attempt.status!=="completed")return <p role="status">{attempt.status==="failed"?attempt.error||"Analysis failed. Retry your recording in Practice Drill.":"This attempt did not finish yet. If interrupted, retry the original recording or delete this entry."}</p>;
  const {metrics:m,analysis:a,segments}=attempt;const current=segments.find(s=>s.index===selected)||segments[0];
  function focus(index:number){setSelected(index);const segment=segments.find(s=>s.index===index);if(player.current&&segment)player.current.currentTime=segment.start;}
  function evidence(item:Evidence,i:number){return <li key={i}><span className="badge">{item.kind}</span> {item.text}<div className="evidence-links">{item.segments.slice(0,8).map(index=>{const s=segments.find(s=>s.index===index);return s?<button key={index} className="text-button" onClick={()=>focus(index)}>{seconds(s.start)} · evidence</button>:null;})}</div></li>;}
  return <div className="interview-report">
    {attempt.is_mock && <p className="resume-warning" role="note">Demo fixture — this synthetic transcript is not a transcription of your voice. Excluded from progress and pattern calculations.</p>}
    <div className="report-score-grid">{Object.entries(a.scores).map(([key,value])=><div key={key}><strong>{Math.round(value)}<small>/100</small></strong><span>{key}</span></div>)}</div>
    <p>{a.summary}</p><details><summary>How this coaching score works</summary><p>{a.score_explanation}</p><p>Analysis confidence: {a.confidence}. {a.semantic_method}. Pipeline {attempt.pipeline_version}; rubric {attempt.rubric_version}.</p></details>
    <h3>Interview MRI</h3><p className="muted">Select a segment to inspect its evidence. Word timestamps come from transcription; STAR and relevance labels are inferences. Audio is available only while this recording remains in the current practice session.</p>
    {audioUrl && <audio controls src={audioUrl} ref={player} aria-label="Play answer with transcript" onTimeUpdate={()=>{const t=player.current?.currentTime||0;const s=segments.find(s=>s.start<=t&&s.end>=t);if(s)setSelected(s.index);}} />}
    <div className="mri-timeline" aria-label="Response segments by time">{segments.map(s=><button key={s.index} className={`mri-segment star-${s.star}`} aria-pressed={current?.index===s.index} style={{flexGrow:Math.max(.1,s.end-s.start)}} onClick={()=>focus(s.index)} title={`${seconds(s.start)}–${seconds(s.end)} · ${s.star} · ${s.wpm} WPM`}><span>{seconds(s.start)}</span><strong>{s.star}</strong><small>{Math.round(s.wpm)} WPM{s.fillers.length?` · ${s.fillers.length} fillers`:""}{s.evidence?" · numeric detail":""}</small></button>)}</div>
    <p className="muted">Timeline widths reflect segment duration; gaps are listed below. S = situation · T = task · A = actions · R = result · unknown = uncertain.</p>
    <div className="evidence-links" aria-label="Pause locations">{m.pauses.map((p,i)=><button key={i} className="text-button" onClick={()=>focus((segments.find(s=>s.start>=p.end)||segments.at(-1))!.index)}>{p.long?"Long gap":"Gap"} {seconds(p.start)} · {p.seconds}s</button>)}</div>
    <svg className="pace-chart" viewBox="0 0 640 150" role="img" aria-label="Speaking pace by segment. Exact WPM and timestamps are available in the transcript list below.">
      <line x1="40" y1="120" x2="620" y2="120" stroke="currentColor" /><text x="5" y="15">WPM</text><text x="40" y="145">0:00</text><text x="560" y="145">{seconds(attempt.duration)}</text>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={segments.map(s=>`${40+580*s.start/attempt.duration},${120-100*s.wpm/Math.max(200,...segments.map(x=>x.wpm))}`).join(' ')} />
      {segments.map(s=><circle key={s.index} cx={40+580*s.start/attempt.duration} cy={120-100*s.wpm/Math.max(200,...segments.map(x=>x.wpm))} r="4" fill="var(--accent)"><title>{seconds(s.start)}: {s.wpm} WPM</title></circle>)}
    </svg>
    {current && <aside className="mri-evidence" aria-live="polite"><h4>{seconds(current.start)}–{seconds(current.end)} · {current.star} · {current.wpm} WPM</h4><p>“{current.text}”</p><p className="muted">{current.evidence?"Numeric detail cue. ":"No numeric detail cue. "}{current.vague?"Vague-word cue: inspect specificity. ":""}{current.relevance===null?"Relevance unavailable.":`Question similarity ${current.relevance.toFixed(2)} (${current.relevance>=.25?"some semantic overlap":"low overlap; review relevance"}). Not a probability.`}</p>{current.fillers.map((f,i)=><span className="badge" key={i}>{f.type} at {seconds(f.start)}</span>)}</aside>}
    <details><summary>Full synchronized transcript</summary><div className="transcript-list">{segments.map(s=><button className={`transcript-segment ${current?.index===s.index?"selected":""}`} key={s.index} onClick={()=>focus(s.index)}><strong>{seconds(s.start)}–{seconds(s.end)} · {s.star} · {s.wpm} WPM</strong><span>{s.text}</span></button>)}</div></details>
    <div className="report-columns"><section><h3>Strengths to retain</h3><ul className="coaching-list">{a.strengths.map(evidence)}</ul></section><section><h3>Next three improvements</h3><ol className="coaching-list">{a.improvements.map(evidence)}</ol></section></div>
    <h3>Delivery meets content</h3><ul className="coaching-list">{a.intersections.map(evidence)}</ul>
    <div className="mri-evidence"><h3>Your next exercise</h3><p>{a.exercise}</p></div>
    <h3>A tighter answer outline</h3><ol>{a.outline.map(o=><li key={o.section}><strong>{o.section}:</strong> {o.prompt} {o.segments.length?`Use segments ${o.segments.map(i=>i+1).join(', ')}.`:"Supply this missing detail yourself."}</li>)}</ol>
    <details><summary>All observed metrics and limitations</summary>
      <dl className="report-facts"><dt>Duration / words / overall pace</dt><dd>{seconds(attempt.duration)} / {m.total_words} / {m.wpm} WPM</dd><dt>Recognized-word speaking pace</dt><dd>{m.speaking_wpm} WPM (excludes gaps)</dd><dt>Fillers</dt><dd>{m.filler_count} total · {m.filler_rate}/minute · {Object.entries(m.filler_types).map(([k,v])=>`${k}: ${v}`).join(', ')||"None detected"}</dd><dt>Average sentence / longest stretch without a ≥1.5s gap</dt><dd>{m.average_sentence_length} words / {m.longest_monologue}s</dd><dt>Numeric mentions / pronouns</dt><dd>{m.numeric_mentions} / I-me-my: {m.ownership.individual}, we-us-our: {m.ownership.team}</dd><dt>Repeated words / phrases</dt><dd>{Object.entries(m.repeated_words).map(([p,c])=>`${p} (${c})`).join(', ')||"None"}; {m.repeated_phrases.map(p=>`${p.phrase} (${p.count})`).join(', ')||"no repeated three-word phrases"}</dd></dl>
      <p>Gaps between recognized words (not a definitive silence measure): {m.pauses.map(p=>`${seconds(p.start)}–${seconds(p.end)}: ${p.seconds}s${p.long?" (long)":""}`).join('; ')||"None ≥1.5s"}.</p>
      {m.activity && <p>Energy estimate: {m.activity.active_seconds}s active / {m.activity.quiet_seconds}s quiet. {m.activity.method}.</p>}
      <ul>{STAR_KEYS.map(k=><li key={k}>{k}: {m.star[k].words} words · {m.star[k].seconds}s · {m.star[k].percent}% of segment time</li>)}</ul>
      <p>{a.ownership_clarity} {a.action_depth} {a.result_strength} {a.coherence} {a.intent_assessment}</p><ul>{a.limitations.map(l=><li key={l}>{l}</li>)}</ul>
    </details>
  </div>;
}
