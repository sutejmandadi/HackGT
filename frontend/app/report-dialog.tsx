"use client";
import { useEffect, useRef, type ReactNode } from "react";

export default function ReportDialog({children,onClose}:{children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=ref.current!;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow="hidden";
    return ()=>{dialog.close();document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return <dialog ref={ref} className="report-dialog" aria-labelledby="report-dialog-title"
    onCancel={e=>{e.preventDefault();onClose();}}
    onClick={e=>{if(e.target===e.currentTarget){const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)onClose();}}}>
    <div className="report-dialog-toolbar"><span>Interview Report</span><button autoFocus className="text-button" onClick={onClose}>Close report</button></div>
    {children}
  </dialog>;
}
