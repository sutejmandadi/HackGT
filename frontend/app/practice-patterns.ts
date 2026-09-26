import type { Attempt } from "./practice-types";
export function realAttempts(attempts:Attempt[]){
  return attempts.filter(a=>a.status==="completed"&&!a.is_mock).sort((a,b)=>a.created_at.localeCompare(b.created_at));
}
export function compareAttempts(before:Attempt,after:Attempt){
  if(before.question_id!==after.question_id||before.is_mock||after.is_mock||before.rubric_version!==after.rubric_version||before.pipeline_version!==after.pipeline_version)return ["Compare real attempts of the same question and analysis version."];
  const delta=(n:number)=>`${n>0?"+":""}${Math.round(n*10)/10}`;
  const notes=[`Preliminary comparison: score ${delta(after.analysis.scores.Overall-before.analysis.scores.Overall)}, pace ${delta(after.metrics.wpm-before.metrics.wpm)} WPM, fillers ${delta(after.metrics.filler_rate-before.metrics.filler_rate)}/min, duration ${delta(after.duration-before.duration)}s.`];
  if(after.duration<before.duration && after.metrics.numeric_mentions<before.metrics.numeric_mentions)notes.push("The later answer is shorter but contains fewer numeric details. Review both transcripts to check whether useful evidence was lost.");
  if(after.metrics.filler_rate<before.metrics.filler_rate)notes.push("The later transcript has fewer detected fillers per minute. Transcription differences can affect this measure.");
  return notes;
}
export function patterns(attempts:Attempt[]):{text:string;ids:string[]}[]{
  const real=realAttempts(attempts),latest=real.at(-1);
  const rows=real.filter(a=>a.rubric_version===latest?.rubric_version&&a.pipeline_version===latest?.pipeline_version);
  if(rows.length<5||new Set(rows.map(a=>a.question_id)).size<2)return [];
  const result:{text:string;ids:string[]}[]=[];
  for(const key of ["situation","task","actions","result"] as const){
    const low=rows.filter(a=>a.metrics.star[key].percent<10);
    if(low.length>=3&&low.length/rows.length>=.6)result.push({text:`Preliminary pattern: ${key} takes less than 10% of segment time in ${low.length}/${rows.length} comparable attempts. Check these inferred labels before treating this as a habit.`,ids:low.map(a=>a.id)});
  }
  for(const competency of [...new Set(rows.map(a=>a.competency))]){
    const group=rows.filter(a=>a.competency===competency);
    if(group.length<3)continue;
    const rushed=group.filter(a=>a.segments.some(s=>(s.star==="actions"||s.star==="result")&&s.wpm>a.metrics.wpm+30));
    if(rushed.length>=3)result.push({text:`Preliminary ${competency.replaceAll('_',' ')} pattern: ${rushed.length}/${group.length} attempts have an Action or Result segment at least 30 WPM above the full-answer pace. Segment pace excludes gaps; inspect the evidence.`,ids:rushed.map(a=>a.id)});
    const teams=group.filter(a=>a.segments.some(s=>s.star==="actions"&&/\bwe\b/i.test(s.text)&&! /\bI\b/.test(s.text)));
    if(teams.length>=3)result.push({text:`In ${teams.length} ${competency.replaceAll('_',' ')} attempts, at least one Action uses “we” without “I.” Team credit is appropriate; clarify your own decision where needed.`,ids:teams.map(a=>a.id)});
  }
  const phraseMap=new Map<string,Attempt[]>();
  for(const a of rows){
    const tokens=a.transcript.toLowerCase().match(/\b[\w']+\b/g)||[];
    for(const phrase of new Set(tokens.slice(0,-4).map((_,i)=>tokens.slice(i,i+5).join(' ')))){const list=phraseMap.get(phrase)||[];list.push(a);phraseMap.set(phrase,list);}
  }
  const reused=[...phraseMap].find(([,group])=>group.length>=3&&new Set(group.map(a=>a.question_id)).size>=2);
  if(reused)result.push({text:`Phrase reuse cue: “${reused[0]}” occurs in ${reused[1].length} attempts across different questions. Reusing relevant language is fine; check whether the answer is tailored.`,ids:reused[1].map(a=>a.id)});
  const storyGroups=new Map<string,Attempt[]>();
  for(const a of rows)if(a.linked_story_id)storyGroups.set(a.linked_story_id,[...(storyGroups.get(a.linked_story_id)||[]),a]);
  const reusedStory=[...storyGroups.values()].find(group=>group.length>=3&&new Set(group.map(a=>a.question_id)).size>=2);
  if(reusedStory)result.push({text:`One linked story appears in ${reusedStory.length} attempts across multiple questions. Check that each answer targets the specific prompt.`,ids:reusedStory.map(a=>a.id)});
  const clustered=rows.filter(a=>a.segments.some(s=>s.fillers.length>=3));
  if(clustered.length>=3)result.push({text:`Filler clusters (at least three in one transcript segment) appear in ${clustered.length} attempts. Inspect the marked transitions and practice a brief silent pause.`,ids:clustered.map(a=>a.id)});
  if(rows.length>=6){
    const first=rows.slice(0,3),last=rows.slice(-3),avg=(a:Attempt[],key:string)=>a.reduce((n,x)=>n+x.analysis.scores[key],0)/a.length;
    result.push({text:`Preliminary trend, earliest three versus latest three comparable attempts: overall ${avg(first,'Overall').toFixed(0)} → ${avg(last,'Overall').toFixed(0)}; specificity ${avg(first,'Specificity').toFixed(0)} → ${avg(last,'Specificity').toFixed(0)}. Different prompts and stories can affect this comparison.`,ids:[...first,...last].map(a=>a.id)});
  }
  return result.slice(0,8);
}
