export type Star = "situation" | "task" | "actions" | "result" | "unknown";
export const STAR_KEYS: Star[] = ["situation", "task", "actions", "result", "unknown"];
export type Evidence = { kind: "observation" | "inference" | "recommendation"; text: string; segments: number[] };
export type Segment = { index: number; start: number; end: number; text: string; star: Star; relevance: number | null; evidence: boolean; vague: boolean; wpm: number };
export type Metrics = {
  duration: number; total_words: number; wpm: number; speaking_wpm: number;
  pauses: { start: number; end: number; seconds: number; long: boolean }[];
  star: Record<Star,{ words: number; seconds: number; percent: number }>; ownership: { individual: number; team: number };
  numeric_mentions: number; average_sentence_length: number; longest_monologue: number; redundancy_ratio: number;
  repeated_phrases: { phrase: string; count: number }[]; repeated_words: Record<string,number>;
  activity: { active_seconds: number; quiet_seconds: number; method: string } | null;
};
export type Coaching = {
  scores: Record<string,number>; score_explanation: string; summary: string;
  strengths: Evidence[]; improvements: Evidence[]; intersections: Evidence[]; exercise: string;
  outline: { section: string; segments: number[]; prompt: string }[]; confidence: string; limitations: string[];
  semantic_method: string; intent_assessment: string; ownership_clarity: string; action_depth: string; result_strength: string; coherence: string;
};
export type Attempt = {
  id: string; question_id: string; prompt: string; competency: string; linked_story_id: string | null; created_at: string;
  status: "processing" | "failed" | "completed"; error: string | null; duration: number; transcript: string;
  segments: Segment[]; metrics: Metrics; analysis: Coaching; pipeline_version: string; rubric_version: string; is_mock: boolean;
};
export function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== "object") return false;
  const a = value as Attempt;
  if (typeof a.id !== "string" || typeof a.prompt !== "string" || typeof a.question_id !== "string" || typeof a.competency !== "string" || !Number.isFinite(Date.parse(a.created_at)) || !["processing","failed","completed"].includes(a.status)) return false;
  if(a.status!=="completed")return true;
  if(!Number.isFinite(a.duration)||typeof a.transcript!=="string"||!Array.isArray(a.segments)||!a.segments.length||!a.metrics||!a.analysis)return false;
  if(!a.segments.every(s=>typeof s.text==="string"&&Number.isFinite(s.start)&&Number.isFinite(s.end)&&STAR_KEYS.includes(s.star)&&Number.isFinite(s.wpm)))return false;
  const m=a.metrics,c=a.analysis;
  if(![m.wpm,m.total_words,m.numeric_mentions,m.average_sentence_length,m.longest_monologue,m.ownership?.individual,m.ownership?.team].every(Number.isFinite))return false;
  if(!STAR_KEYS.every(k=>m.star?.[k]&&[m.star[k].percent,m.star[k].seconds,m.star[k].words].every(Number.isFinite)))return false;
  if(!Array.isArray(m.pauses)||!Array.isArray(m.repeated_phrases)||!m.repeated_words)return false;
  if(!c.scores||!Number.isFinite(c.scores.Overall)||!Object.values(c.scores).every(Number.isFinite))return false;
  return [c.strengths,c.improvements,c.intersections].every(list=>Array.isArray(list)&&list.every(f=>typeof f.text==="string"&&Array.isArray(f.segments)&&f.segments.every(i=>a.segments.some(s=>s.index===i))))&&Array.isArray(c.outline)&&Array.isArray(c.limitations);
}
export function seconds(value: number) { return `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,"0")}`; }

export function currentReport(a: Attempt): Attempt {
  if(a.status!=="completed"||a.rubric_version==="coaching-3.0"||a.rubric_version.endsWith("-revised-delivery"))return a;
  const result=structuredClone(a), c=result.analysis;
  const retired=(text:string)=>/filler/i.test(text);
  c.strengths=c.strengths.filter(x=>!retired(x.text));
  c.improvements=c.improvements.filter(x=>!retired(x.text));
  c.intersections=c.intersections.filter(x=>!retired(x.text));
  c.limitations=c.limitations.filter(x=>!retired(x));
  if(retired(c.summary))c.summary=c.improvements[0]?.text||"Review your actions and outcome, then choose one detail to improve.";
  if(retired(c.exercise))c.exercise="Practice a concise answer that explains your responsibility, decisions, and outcome.";
  const pace=Math.max(0,1-Math.abs(a.metrics.wpm-145)/100);
  const gap=a.metrics.pauses.filter(p=>p.long).reduce((n,p)=>n+p.seconds,0)/Math.max(a.duration,1);
  c.scores.Delivery=Math.round(100*(.7*pace+.3*Math.max(0,1-gap/.3))*10)/10;
  const values=Object.entries(c.scores).filter(([key])=>key!=="Overall").map(([,v])=>v);
  c.scores.Overall=Math.round(values.reduce((n,v)=>n+v,0)/values.length*10)/10;
  c.score_explanation="Delivery has been updated to use pace (70%) and long-gap control (30%). Overall averages the available categories. Other categories retain the original report rubric.";
  result.rubric_version+="-revised-delivery";
  return result;
}
