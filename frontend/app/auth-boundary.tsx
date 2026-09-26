"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { type User } from "@supabase/supabase-js";
import { cloudConfigured, getSupabase } from "./supabase";

export default function AuthBoundary({ children }: { children: (user: User | null) => ReactNode }) {
  return cloudConfigured ? <CloudAuth>{children}</CloudAuth> : <>
    <div className="connection-banner">Local-only mode · Database not configured. Your existing browser stories are available. Follow SUPABASE_SETUP.md to connect.</div>
    {children(null)}
  </>;
}

function CloudAuth({ children }: { children: (user: User | null) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const confirmationHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (confirmationEmail) confirmationHeading.current?.focus();
  }, [confirmationEmail]);

  useEffect(() => {
    let active = true;
    try {
      const supabase = getSupabase();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) { setUser(session?.user ?? null); setLoading(false); }
      });
      supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(error.message);
        setUser(data.session?.user ?? null); setLoading(false);
      }).catch((error) => { if (active) { setMessage(String(error)); setLoading(false); } });
      return () => { active = false; subscription.unsubscribe(); };
    } catch {
      // Configuration problems must not silently fall back to local storage.
      queueMicrotask(() => { if (active) { setMessage("Invalid Supabase configuration. Check .env.local and restart the dev server."); setLoading(false); } });
      return () => { active = false; };
    }
  }, []);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = getSupabase();
      const { data, error } = creating
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword("");
      if (creating && !data.session) setConfirmationEmail(email.trim());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in. Try again."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (document.querySelector('[data-practice-locked="true"]')) { setMessage("Analyze or discard your recording before signing out."); return; }
    if (!window.confirm("Sign out? Save any current edits first; unsaved edits will be discarded.")) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign out."); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="bank-main" role="status">Connecting to your account…</main>;
  if (user) return <>
    <div className="connection-banner"><span>Cloud storage · {user.email}</span><button className="text-button" disabled={busy} onClick={signOut}>Sign out</button>{message && <span role="alert">{message}</span>}</div>
    {children(user)}
  </>;
  if (confirmationEmail) return <main className="auth-shell">
    <section className="editor" aria-labelledby="confirmation-heading">
      <p className="eyebrow">One more step</p>
      <h1 id="confirmation-heading" ref={confirmationHeading} tabIndex={-1}>Check your email</h1>
      <p className="intro" role="status">Check <strong style={{ overflowWrap: "anywhere", color: "var(--text)" }}>{confirmationEmail}</strong> for your account confirmation link.</p>
      <ol style={{ paddingLeft: "var(--s6)", margin: "var(--s6) 0" }}>
        <li>Open the confirmation email from Supabase.</li>
        <li>Click the link to confirm your email address.</li>
        <li>Return here and sign in to your MeCode.</li>
      </ol>
      <p className="muted">Keep the app running and open the link on this computer. If the email hasn&apos;t arrived, check spam or junk and allow a few minutes.</p>
      <button className="primary" style={{ marginTop: "var(--s6)" }} onClick={() => { setConfirmationEmail(""); setCreating(false); setMessage(""); }}>Back to sign in</button>
      <button className="text-button" onClick={() => { setConfirmationEmail(""); setCreating(true); setMessage(""); }}>Use a different email</button>
    </section>
  </main>;
  return <main className="auth-shell"><section className="editor">
    <p className="eyebrow">MeCode</p><h1>{creating ? "Create your account" : "Welcome back"}</h1>
    <p className="intro">Keep your stories private and access them across devices.</p>
    <form onSubmit={authenticate}>
      <label className="field">Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="field">Password<input type="password" minLength={creating ? 8 : 1} autoComplete={creating ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <p role="status" className="save-feedback">{message}</p>
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</button>
    </form>
    <button className="text-button" disabled={busy} onClick={() => { setCreating(!creating); setMessage(""); }}>{creating ? "Already registered? Sign in" : "New here? Create an account"}</button>
  </section></main>;
}

