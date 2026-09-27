"use client";
import { useRef, useState } from "react";
import { seconds, STAR_KEYS, type Attempt, type Evidence } from "./practice-types";

export default function InterviewReport({attempt,audioUrl}:{attempt:Attempt;audioUrl?:string}){
  const [selected,setSelected]=useState(0);const [expanded,setExpanded]=useState(true);const player=useRef<HTMLAudioElement>(null);
  if(attempt.status!=="completed")return <p role="status">{attempt.status==="failed"?attempt.error||"Analysis failed. Retry your recording in Practice Drill.":"This attempt did not finish yet. If interrupted, retry the original recording or delete this entry."}</p>;
  const {metrics:m,analysis:a,segments}=attempt;const current=segments.find(s=>s.index===selected)||segments[0];
  const scoreOrder=["Overall","Delivery","Structure","Specificity","Relevance","Impact"];
  const orderedScores=Object.entries(a.scores).sort(([left],[right])=>{
    const rank=(key:string)=>scoreOrder.includes(key)?scoreOrder.indexOf(key):scoreOrder.length;
    return rank(left)-rank(right);
  });
  const calculationSentences=a.score_explanation.split(/(?<=[.!?])\s+/);
  const calculationGroups=scoreOrder.map(category=>({category,sentences:calculationSentences.filter(text=>text.startsWith(category+" "))})).filter(group=>group.sentences.length);
  const calculationNotes=calculationSentences.filter(text=>!scoreOrder.some(category=>text.startsWith(category+" ")));
  function focus(index:number){setExpanded(true);setSelected(index);const segment=segments.find(s=>s.index===index);if(player.current&&segment)player.current.currentTime=segment.start;}
  function evidence(item:Evidence,i:number){return <li key={i}>{item.text}<div className="evidence-links">{item.segments.slice(0,8).map(index=>{const s=segments.find(s=>s.index===index);return s?<button key={index} className="text-button" onClick={()=>focus(index)}>{seconds(s.start)} · View passage</button>:null;})}</div></li>;}
  return <div className="interview-report">
    {attempt.pipeline_version.startsWith("demo-seed-") && <p className="resume-warning">Demo dataset · Fictional experience, transcript, and timing for demonstration.</p>}
    {attempt.is_mock && <p className="resume-warning" role="note">Sample report: this uses example text, not your spoken answer. Scores and pacing are hidden, and this report does not count toward progress.</p>}
    {!attempt.is_mock && <div className="report-score-grid">{orderedScores.map(([key,value])=><div key={key}><strong>{Math.round(value)}<small>/100</small></strong><span>{key}</span></div>)}</div>}
    <details><summary>How scoring works</summary>
      <p>The overall score averages the available categories. A high score needs strong evidence across the answer, not just the right keywords.</p>
      <dl className="report-facts"><dt>Delivery</dt><dd>Steady pace and limited long gaps.</dd><dt>Structure</dt><dd>Clear context and responsibility, with most time on actions and outcomes.</dd><dt>Specificity</dt><dd>Your actions, reasons, checks, and concrete details.</dd><dt>Relevance</dt><dd>How closely the answer relates to the question.</dd><dt>Impact</dt><dd>A clear outcome, supporting detail, and what you learned.</dd></dl>
      <p className="muted">These are coaching estimates, not a prediction of interview success. Automatic labels can be wrong; check the transcript.</p>
      <details><summary>Calculation details for this report</summary><div className="calculation-grid">{calculationGroups.map(({category,sentences})=><section className="calculation-category" key={category}><h4>{category}</h4>{sentences.map(text=><p key={text}>{text.slice(category.length).trim().replace(/^./,letter=>letter.toUpperCase())}</p>)}</section>)}</div>{calculationNotes.map(text=><p className="muted" key={text}>{text}</p>)}<p className="calculation-version">Rubric: {attempt.rubric_version}</p></details>
    </details>
    <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)} className="response-disclosure"><summary>Transcript and delivery</summary>
    <h3>Answer breakdown</h3><p className="muted">Select a passage to review it. STAR labels are automatic suggestions.</p>
    {audioUrl && <audio controls src={audioUrl} ref={player} aria-label="Play answer with transcript" onTimeUpdate={()=>{const t=player.current?.currentTime||0;const s=segments.find(s=>s.start<=t&&s.end>=t);if(s)setSelected(s.index);}} />}
    <div className="mri-timeline" aria-label="Response segments by time">{segments.map(s=><button key={s.index} className={`mri-segment star-${s.star}`} aria-pressed={current?.index===s.index} style={{flexGrow:Math.max(.1,s.end-s.start)}} onClick={()=>focus(s.index)} title={`${seconds(s.start)}–${seconds(s.end)} · ${s.star.charAt(0).toUpperCase()+s.star.slice(1)} · ${s.wpm} WPM`}><span>{seconds(s.start)}</span><strong>{s.star.charAt(0).toUpperCase()+s.star.slice(1)}</strong><small>{!attempt.is_mock && <>{Math.round(s.wpm)} WPM</>}{s.evidence?" · numeric detail":""}</small></button>)}</div>
    <p className="muted">Timeline widths reflect segment duration; gaps are listed below. S = situation · T = task · A = actions · R = result · unknown = uncertain.</p>
    <div className="evidence-links" aria-label="Pause locations">{m.pauses.map((p,i)=><button key={i} className="text-button" onClick={()=>focus((segments.find(s=>s.start>=p.end)||segments.at(-1))!.index)}>{p.long?"Long gap":"Gap"} {seconds(p.start)} · {p.seconds}s</button>)}</div>
    {!attempt.is_mock && <svg className="pace-chart" viewBox="0 0 640 150" role="img" aria-label="Speaking pace by segment. Exact WPM and timestamps are available in the transcript list below.">
      <line x1="40" y1="120" x2="620" y2="120" stroke="currentColor" /><text x="5" y="15">WPM</text><text x="40" y="145">0:00</text><text x="560" y="145">{seconds(attempt.duration)}</text>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={segments.map(s=>`${40+580*s.start/attempt.duration},${120-100*s.wpm/Math.max(200,...segments.map(x=>x.wpm))}`).join(' ')} />
      {segments.map(s=><circle key={s.index} cx={40+580*s.start/attempt.duration} cy={120-100*s.wpm/Math.max(200,...segments.map(x=>x.wpm))} r="4" fill="var(--accent)"><title>{seconds(s.start)}: {s.wpm} WPM</title></circle>)}
    </svg>}
    {current && <aside className="mri-evidence" aria-live="polite"><h4>{seconds(current.start)}–{seconds(current.end)} · {current.star.charAt(0).toUpperCase()+current.star.slice(1)}{!attempt.is_mock && <> · {current.wpm} WPM</>}</h4><p>“{current.text}”</p></aside>}
    <details><summary>Full synchronized transcript</summary><div className="transcript-list">{segments.map(s=><button className={`transcript-segment ${current?.index===s.index?"selected":""}`} key={s.index} onClick={()=>focus(s.index)}><strong>{seconds(s.start)}–{seconds(s.end)} · {s.star.charAt(0).toUpperCase()+s.star.slice(1)}{!attempt.is_mock && <> · {s.wpm} WPM</>}</strong><span>{s.text}</span></button>)}</div></details>
    </details><div className="report-columns coaching-editorial"><section className="coaching-positive"><h3><span aria-hidden="true">✓</span> What worked</h3><ul className="coaching-list">{a.strengths.map(evidence)}</ul></section><section className="coaching-next"><h3><span aria-hidden="true">↗</span> What to improve</h3><ol className="coaching-list">{a.improvements.map(evidence)}</ol></section></div>
    {!attempt.is_mock && <section className="delivery-insights" aria-label="Delivery insights">
      <header className="insight-heading"><div><span className="insight-kicker">A closer look</span><h3>How your answer unfolds</h3></div><span className="insight-caption">Delivery + structure</span></header>
      <div className="answer-balance" aria-label="Estimated time by STAR section">{STAR_KEYS.filter(key=>m.star[key].percent>0).map(key=><div key={key} className={`balance-part balance-${key}`} style={{flex:m.star[key].percent}} title={`${key}: ${m.star[key].percent}%`} />)}</div>
      <div className="balance-legend">{STAR_KEYS.filter(key=>m.star[key].percent>0).map(key=><span key={key}><i className={`balance-${key}`} aria-hidden="true"/>{key.charAt(0).toUpperCase()+key.slice(1)} <strong>{Math.round(m.star[key].percent)}%</strong></span>)}</div>
      <p className="insight-caption">Estimated section timing. Review the transcript labels for accuracy.</p>
      <div className="insight-cards">{a.intersections.map((item,i)=>{
        const title=/context takes/i.test(item.text)?"Balance your setup":/actions pace/i.test(item.text)?"Pace through your actions":/result pace/i.test(item.text)?"Give the outcome space":"Connect effort to impact";
        return <article className="insight-card" key={i}><div className="insight-card-heading"><span className="insight-number" aria-hidden="true">{String(i+1).padStart(2,"0")}</span><h4>{title}</h4></div><p>{item.text}</p><div className="insight-passages">{item.segments.slice(0,3).map(index=>{const segment=segments.find(s=>s.index===index);return segment?<button className="text-button" key={index} onClick={()=>focus(index)}>Review {seconds(segment.start)} <span aria-hidden="true">↗</span></button>:null;})}</div></article>;
      })}</div>
    </section>}
    <details className="report-methods"><summary>Metrics and limitations</summary>
      {!attempt.is_mock && <>
        <dl className="metric-strip"><div><dt>Recording length</dt><dd>{seconds(attempt.duration)}</dd></div><div><dt>Words spoken</dt><dd>{m.total_words}</dd></div><div><dt>Overall pace</dt><dd>{m.wpm}<small> WPM</small></dd></div></dl>
        <div className="methods-columns"><section><h4>Delivery measures</h4><dl className="metric-ledger">
          <div><dt>Recognized-word pace <small>Excludes gaps between words</small></dt><dd>{m.speaking_wpm} WPM</dd></div>
          <div><dt>Average sentence</dt><dd>{m.average_sentence_length} words</dd></div>
          <div><dt>Longest stretch <small>Without a gap of 1.5 seconds or more</small></dt><dd>{m.longest_monologue}s</dd></div>
          <div><dt>Numeric mentions</dt><dd>{m.numeric_mentions}</dd></div>
          <div><dt>Individual / team pronouns</dt><dd>{m.ownership.individual} / {m.ownership.team}</dd></div>
        </dl></section><section><h4>Section timing</h4><div className="section-ledger">{STAR_KEYS.map(key=><div className="section-ledger-row" key={key}><span className={`section-color balance-${key}`} aria-hidden="true"/><div><strong>{key.charAt(0).toUpperCase()+key.slice(1)}</strong><small>{m.star[key].words} words · {m.star[key].seconds}s</small></div><span>{m.star[key].percent}%</span></div>)}</div><p className="methods-note">Shares reflect labeled segment time, not the full recording.</p></section></div>
        <section className="observation-ledger"><h4>Recording notes</h4><dl className="metric-ledger">
          <div><dt>Repeated words</dt><dd>{Object.entries(m.repeated_words).map(([word,count])=>`${word} (${count})`).join(', ')||"None detected"}</dd></div>
          <div><dt>Repeated phrases</dt><dd>{m.repeated_phrases.map(p=>`${p.phrase} (${p.count})`).join(', ')||"None detected"}</dd></div>
          <div><dt>Word gaps </dt><dd>{m.pauses.map(p=>`${seconds(p.start)}–${seconds(p.end)}: ${p.seconds}s${p.long?" (long)":""}`).join('; ')||"None of 1.5 seconds or more"}</dd></div>
          {m.activity && <div><dt>Audio energy estimate</dt><dd>{m.activity.active_seconds}s active / {m.activity.quiet_seconds}s quiet<small>{m.activity.method}</small></dd></div>}
        </dl></section>
      </>}
    </details>
  </div>;
}
