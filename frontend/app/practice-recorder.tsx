"use client";
import { useEffect, useRef, useState } from "react";
import type { BehavioralQuestion } from "./questions";
import { isAttempt, seconds, type Attempt } from "./practice-types";
import { practiceHeaders, saveLocalAttempt } from "./practice-repository";
import { cloudConfigured } from "./supabase";
import InterviewReport from "./interview-report";

export default function PracticeRecorder({question,linkedStoryId,onLock,onSaved,onReports}: {
  question: BehavioralQuestion; linkedStoryId: string | null; onLock: (locked: boolean)=>void; onSaved: ()=>void; onReports: ()=>void;
}) {
  const [state,setState]=useState("idle"), [elapsed,setElapsed]=useState(0), [level,setLevel]=useState(0);
  const [blob,setBlob]=useState<Blob|null>(null), [url,setUrl]=useState(""), [error,setError]=useState("");
  const [stage,setStage]=useState(""), [report,setReport]=useState<Attempt|null>(null);
  const [provider,setProvider]=useState<{mode:string;ready:boolean;message?:string}|null>(null);
  const recorder=useRef<MediaRecorder|null>(null), stream=useRef<MediaStream|null>(null), audio=useRef<AudioContext|null>(null);
  const chunks=useRef<Blob[]>([]), byteCount=useRef(0), frame=useRef(0), started=useRef(0), accumulated=useRef(0);
  const attemptId=useRef(""), abort=useRef<AbortController|null>(null), mounted=useRef(true), working=useRef(false);
  const objectUrl=useRef(""), generation=useRef(0);
  const locked=["requesting","recording","paused","review","busy"].includes(state);
  useEffect(()=>{onLock(locked);},[locked,onLock]);
  useEffect(()=>{
    let active=true;
    practiceHeaders().then(headers=>fetch('/api/practice?configuration=1',{headers,cache:'no-store'})).then(res=>res.ok?res.json():null).then(data=>{if(active&&data&&typeof data.mode==='string')setProvider(data);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{ mounted.current=false; abort.current?.abort(); if(recorder.current?.state!=="inactive") recorder.current?.stop(); stream.current?.getTracks().forEach(t=>t.stop()); cancelAnimationFrame(frame.current); void audio.current?.close(); if(objectUrl.current)URL.revokeObjectURL(objectUrl.current); };
  },[]);
  useEffect(()=>{
    if(!locked)return;
    const warn=(event: BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);return ()=>window.removeEventListener("beforeunload",warn);
  },[locked]);
  useEffect(()=>{
    const hide=()=>{if(document.hidden && recorder.current && recorder.current.state!=="inactive"){recorder.current.stop();setError("Recording stopped when this page became hidden. Review the captured audio or re-record.");}};
    document.addEventListener("visibilitychange",hide);return ()=>document.removeEventListener("visibilitychange",hide);
  },[]);
  function release(){stream.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(frame.current);void audio.current?.close();audio.current=null;setLevel(0);}
  function stop(){if(recorder.current && recorder.current.state!=="inactive")recorder.current.stop();}
  async function start(){
    if(working.current)return; working.current=true;setError("");setReport(null);
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==="undefined"){setError("This browser cannot record audio. Use a current Chrome, Edge, Firefox, or Safari over HTTPS or localhost.");working.current=false;return;}
    setState("requesting");const requestGeneration=++generation.current;
    try{
      const input=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(!mounted.current||generation.current!==requestGeneration){input.getTracks().forEach(t=>t.stop());return;}
      stream.current=input;
      const type=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus"].find(t=>MediaRecorder.isTypeSupported(t));
      const rec=new MediaRecorder(input,type?{mimeType:type,audioBitsPerSecond:64000}:undefined);recorder.current=rec;
      chunks.current=[];byteCount.current=0;accumulated.current=0;started.current=performance.now();attemptId.current=crypto.randomUUID();setElapsed(0);setBlob(null);setUrl("");
      rec.ondataavailable=(event)=>{if(event.data.size){chunks.current.push(event.data);byteCount.current+=event.data.size;if(byteCount.current>12*1024*1024){setError("Recording reached the file-size limit. Please re-record a shorter answer.");stop();}}};
      rec.onstop=()=>{release();if(!mounted.current)return;const data=new Blob(chunks.current,{type:rec.mimeType});if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=URL.createObjectURL(data);setUrl(objectUrl.current);setBlob(data);setState("review");working.current=false;};
      rec.onerror=()=>{setError("Recording was interrupted. Review any captured audio or re-record.");stop();};
      rec.start(250);setState("recording");
      try{
        const context=new AudioContext();audio.current=context;await context.resume();
        const analyser=context.createAnalyser();analyser.fftSize=256;context.createMediaStreamSource(input).connect(analyser);
        const values=new Uint8Array(analyser.fftSize);
        const tick=()=>{
          if(rec.state==="inactive")return;
          const t=accumulated.current+(rec.state==="recording"?(performance.now()-started.current)/1000:0);
          setElapsed(t);if(t>=299){stop();return;}
          analyser.getByteTimeDomainData(values);setLevel(rec.state==="recording"?Math.min(1,Math.sqrt(values.reduce((sum,n)=>sum+((n-128)/128)**2,0)/values.length)*5):0);
          frame.current=requestAnimationFrame(tick);
        };tick();
      }catch{
        // Recording remains usable without an audio visualizer.
        const tick=()=>{if(rec.state==="inactive")return;const t=accumulated.current+(rec.state==="recording"?(performance.now()-started.current)/1000:0);setElapsed(t);if(t>=299)stop();else frame.current=requestAnimationFrame(tick);};tick();
      }
    }catch(err){if(!mounted.current||generation.current!==requestGeneration)return;release();setState("idle");working.current=false;setError(err instanceof DOMException && err.name==="NotAllowedError"?"Microphone access was denied. Allow it in your browser’s site settings, then try again.":"Could not open the microphone. Check that it is connected and not in use by another app.");}
  }
  function pause(){
    const rec=recorder.current;if(!rec)return;
    try {
      if(rec.state==="recording"){rec.pause();accumulated.current+=(performance.now()-started.current)/1000;setState("paused");}
      else if(rec.state==="paused"){rec.resume();started.current=performance.now();setState("recording");}
    } catch {setError("Pause/resume is unavailable in this browser. Stop the recording to review it.");}
  }
  function discard(){if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current="";setBlob(null);setUrl("");setReport(null);setState("idle");setError("");setStage("");setElapsed(0);attemptId.current="";}
  async function submit(){
    if(!blob || state==="busy" || blob.size>12*1024*1024)return;
    setState("busy");setStage("Uploading");setError("");const control=new AbortController();abort.current=control;
    try{
      const meta={id:attemptId.current,question_id:question.id,prompt:question.prompt,competency:question.category,linked_story_id:linkedStoryId};
      const headers: Record<string,string>={...await practiceHeaders(),"Content-Type":blob.type,"X-Practice-Meta":btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(meta))))};
      const response=await fetch('/api/practice',{method:"POST",headers,body:blob,signal:AbortSignal.any([control.signal,AbortSignal.timeout(185000)])});
      if(!response.ok){const data=await response.json();throw new Error(data.error||"Could not analyze recording.");}
      const reader=response.body?.getReader();if(!reader)throw new Error("Analysis stream unavailable. Retry.");
      const decoder=new TextDecoder();let buffer="", saved: Attempt|null=null;
      while(true){
        const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});
        let boundary;
        while((boundary=buffer.indexOf("\n\n"))>=0){
          const packet=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
          if(!packet.startsWith("data: "))continue;
          const data=JSON.parse(packet.slice(6));
          if(data.type==="stage")setStage(data.stage);
          if(data.type==="error")throw new Error(data.error);
          if(data.type==="result"){if(!isAttempt(data.report))throw new Error("Report data was invalid. Retry this recording.");saved=data.report;}
        }
        if(done)break;
      }
      if(!saved)throw new Error("Analysis was interrupted. Retry the same recording; saved attempts will not duplicate.");
      if(!cloudConfigured)saveLocalAttempt(saved);
      setReport(saved);setState("done");setStage("Report saved");onSaved();
    }catch(err){setState("review");setError(err instanceof Error?err.message:"Analysis failed. Your recording is still here.");}
    finally{abort.current=null;}
  }
  return <section className="practice-recorder" aria-label="Record an interview response" data-practice-locked={locked}>
    <div className="section-heading"><h3>Record your answer</h3><span>{seconds(elapsed)} / 5:00</span></div>
    {provider?.mode==='mock' && <p className="resume-warning">Sample mode: you can record and replay, but analysis uses example text. Connect live transcription to get feedback on your own answer.</p>}
    {provider?.mode==='local' && provider.ready && <p className="muted">Local transcription · No API key required</p>}
    {provider && !provider.ready && <p className="resume-warning">{provider.message} You can still record and replay your answer.</p>}
    <details><summary>Audio privacy</summary><p className="muted">{provider?.mode==='local' ? 'Audio is transcribed on the computer running the backend, without an external transcription service.' : 'Audio is sent to the configured transcription provider when you analyze.'} MeCode deletes temporary audio and saves the transcript and coaching report. English transcription · 12 MB maximum.</p></details>
    <div className="audio-level" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level*100)}><span style={{width:`${level*100}%`}} /></div>
    <div className="practice-controls">
      {state==="idle" && <button className="primary" onClick={start}>Start recording</button>}
      {state==="requesting" && <button className="text-button" onClick={()=>{generation.current++;working.current=false;setState("idle");}}>Cancel microphone request</button>}
      {(state==="recording"||state==="paused") && <><button className="text-button" onClick={pause}>{state==="paused"?"Resume recording":"Pause recording"}</button><button className="primary" onClick={stop}>Stop recording</button></>}
      {blob && <><button className="text-button" disabled={state==="busy"} onClick={discard}>Discard recording</button>{state!=="done" && <button className="primary" disabled={state==="busy"||blob.size>12*1024*1024} onClick={submit}>Analyze Response</button>}</>}
    </div>
    <p role="status" aria-live="polite">{state==="requesting"?"Waiting for microphone permission…":state==="recording"?"Recording. Speak naturally; pauses are part of your response.":state==="paused"?"Paused. Paused time is excluded from the recording.":state==="busy"?`${stage}…`:state==="review"?"Review or replay the recording, then analyze or discard it before switching questions.":stage}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {url && <audio controls src={url} aria-label="Review your recording" />}
    {report && <><button className="text-button" onClick={onReports}>Open saved Reports</button><details className="saved-preview"><summary>View report</summary><InterviewReport attempt={report} audioUrl={url} /></details></>}
  </section>;
}
