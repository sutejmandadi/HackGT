"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { type User } from "@supabase/supabase-js";
import { cloudConfigured, getSupabase } from "./supabase";
import LandingPage from "./landing-page";

export default function AuthBoundary({ children }: { children: (user: User | null) => ReactNode }) {
  const [guestMode, setGuestMode] = useState(false);

  if (guestMode) {
    return <>
      <div className="connection-banner">
        <span>Demo mode · Saved in local browser storage</span>
        {cloudConfigured && <button className="text-button" onClick={() => setGuestMode(false)}>Sign in to sync across devices</button>}
      </div>
      {children(null)}
    </>;
  }

  return cloudConfigured ? (
    <CloudAuth onContinueGuest={() => setGuestMode(true)}>{children}</CloudAuth>
  ) : (
    <LandingPage
      onSignIn={async () => {}}
      onSignUp={async () => {}}
      onContinueGuest={() => setGuestMode(true)}
      busy={false}
      message="Local mode: Cloud database is not configured. Stories are stored on this device."
      creating={false}
      setCreating={() => {}}
    />
  );
}

function CloudAuth({
  children,
  onContinueGuest,
}: {
  children: (user: User | null) => ReactNode;
  onContinueGuest: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
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
      queueMicrotask(() => { if (active) { setMessage("Invalid Supabase configuration. Check .env.local and restart the dev server."); setLoading(false); } });
      return () => { active = false; };
    }
  }, []);

  async function handleSignIn(emailVal: string, passwordVal: string) {
    setBusy(true); setMessage("");
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email: emailVal.trim(), password: passwordVal });
      if (error) throw error;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in. Try again."); }
    finally { setBusy(false); }
  }

  async function handleSignUp(emailVal: string, passwordVal: string) {
    setBusy(true); setMessage("");
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: emailVal.trim(),
        password: passwordVal,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (!data.session) setConfirmationEmail(emailVal.trim());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create account. Try again."); }
    finally { setBusy(false); }
  }

  async function signOut() {
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

  return (
    <LandingPage
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onContinueGuest={onContinueGuest}
      busy={busy}
      message={message}
      creating={creating}
      setCreating={setCreating}
    />
  );
}

