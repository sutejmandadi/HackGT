"use client";
import {useRef,useState} from "react";
import {seconds} from "./practice-types";
export default function RecordingPlayer({src,duration,onDiscard,disabled}:{src:string;duration:number;onDiscard:()=>void;disabled:boolean}) {
  const audio=useRef<HTMLAudioElement>(null);
  const [playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[error,setError]=useState("");
  const [length,setLength]=useState(duration);
  async function toggle(){if(!audio.current)return;if(playing)audio.current.pause();else {try{await audio.current.play();setError("");}catch{setError("Playback could not start. Please try again.");}}}
  return <div className="recording-playback">
    <audio ref={audio} src={src} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onTimeUpdate={()=>setPosition(audio.current?.currentTime||0)} onLoadedMetadata={()=>{const d=audio.current?.duration;if(d&&Number.isFinite(d))setLength(d);}} onError={()=>setError("This recording could not be played.")} />
    <button className="recording-play-toggle" onClick={toggle} aria-label={playing?"Pause playback":"Play recording"}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing?<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>:<path d="m7 4 14 8-14 8z"/>}</svg></button>
    <div className="recording-track"><div className="recording-track-heading"><strong>Your recording</strong><span>{seconds(position)} / {seconds(length)}</span></div><input type="range" aria-label="Recording playback position" aria-valuetext={`${seconds(position)} of ${seconds(length)}`} min={0} max={Math.max(length,.1)} step={.1} value={Math.min(position,length)} onChange={e=>{const next=Number(e.target.value);if(audio.current)audio.current.currentTime=next;setPosition(next);}} /></div>
    <button type="button" className="recording-discard" aria-label="Discard recording" title="Discard recording" disabled={disabled} onClick={onDiscard}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button>
    {error&&<p className="error" role="alert">{error}</p>}
  </div>;
}
