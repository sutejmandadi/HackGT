"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { type User } from "@supabase/supabase-js";
import { cloudConfigured, getSupabase } from "./supabase";
import LandingPage from "./landing-page";

export interface AuthActions {
  signOut?: () => Promise<void>;
  openSignIn?: () => void;
}

export default function AuthBoundary({
  children,
}: {
  children: (
    user: User | null,
    onNavigateLanding: () => void,
    authActions?: AuthActions
  ) => ReactNode;
}) {
  const [guestMode, setGuestMode] = useState(false);
  const [guestViewingLanding, setGuestViewingLanding] = useState(false);

  if (guestMode) {
    if (guestViewingLanding) {
      return (
        <LandingPage
          onSignIn={async () => {}}
          onSignUp={async () => {}}
          onContinueGuest={() => setGuestViewingLanding(false)}
          busy={false}
          message=""
          creating={false}
          setCreating={() => {}}
          guestActive={true}
          onOpenWorkspace={() => setGuestViewingLanding(false)}
        />
      );
    }
    return (
      <>
        {children(null, () => setGuestViewingLanding(true), {
          openSignIn: () => {
            setGuestMode(false);
            setGuestViewingLanding(false);
          },
        })}
      </>
    );
  }

  return cloudConfigured ? (
    <CloudAuth
      onContinueGuest={() => {
        setGuestMode(true);
        setGuestViewingLanding(false);
      }}
    >
      {children}
    </CloudAuth>
  ) : (
    <LandingPage
      onSignIn={async () => {}}
      onSignUp={async () => {}}
      onContinueGuest={() => {
        setGuestMode(true);
        setGuestViewingLanding(false);
      }}
      busy={false}
      message="Local mode: Cloud database is not configured. Stories are stored on this device."
      creating={false}
      setCreating={() => {}}
      guestActive={false}
      onOpenWorkspace={() => {
        setGuestMode(true);
        setGuestViewingLanding(false);
      }}
    />
  );
}

function CloudAuth({
  children,
  onContinueGuest,
}: {
  children: (
    user: User | null,
    onNavigateLanding: () => void,
    authActions?: AuthActions
  ) => ReactNode;
  onContinueGuest: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingLanding, setViewingLanding] = useState(false);
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
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) {
          const newUser = session?.user ?? null;
          setUser(newUser);
          setLoading(false);
        }
      });
      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) setMessage(error.message);
          setUser(data.session?.user ?? null);
          setLoading(false);
        })
        .catch((error) => {
          if (active) {
            setMessage(String(error));
            setLoading(false);
          }
        });
      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch {
      queueMicrotask(() => {
        if (active) {
          setMessage("Invalid Supabase configuration. Check .env.local and restart the dev server.");
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }
  }, []);

  async function handleSignIn(emailVal: string, passwordVal: string) {
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email: emailVal.trim(),
        password: passwordVal,
      });
      if (error) throw error;
      setViewingLanding(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(emailVal: string, passwordVal: string) {
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: emailVal.trim(),
        password: passwordVal,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (!data.session) {
        setConfirmationEmail(emailVal.trim());
      } else {
        setViewingLanding(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create account. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (document.querySelector('[data-practice-locked="true"]')) { setMessage("Analyze or discard your recording before signing out."); return; }
    if (!window.confirm("Sign out? Save any current edits first; unsaved edits will be discarded.")) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      setMessage("");
      setUser(null);
      setViewingLanding(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="bank-main" role="status">Connecting to your account…</main>;

  if (confirmationEmail)
    return (
      <main className="auth-shell">
        <section className="editor" aria-labelledby="confirmation-heading">
          <p className="eyebrow">One more step</p>
          <h1 id="confirmation-heading" ref={confirmationHeading} tabIndex={-1}>
            Check your email
          </h1>
          <p className="intro" role="status">
            Check <strong style={{ overflowWrap: "anywhere", color: "var(--text)" }}>{confirmationEmail}</strong> for your account confirmation link.
          </p>
          <ol style={{ paddingLeft: "var(--s6)", margin: "var(--s6) 0" }}>
            <li>Open the confirmation email from Supabase.</li>
            <li>Click the link to confirm your email address.</li>
            <li>Return here and sign in to your MeCode.</li>
          </ol>
          <p className="muted">Keep the app running and open the link on this computer. If the email hasn&apos;t arrived, check spam or junk and allow a few minutes.</p>
          <button className="primary" style={{ marginTop: "var(--s6)" }} onClick={() => { setConfirmationEmail(""); setCreating(false); setMessage(""); }}>
            Back to sign in
          </button>
          <button className="text-button" onClick={() => { setConfirmationEmail(""); setCreating(true); setMessage(""); }}>
            Use a different email
          </button>
        </section>
      </main>
    );

  // If user is logged in, but has navigated to landing page:
  if (user && viewingLanding) {
    return (
      <LandingPage
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onContinueGuest={onContinueGuest}
        busy={busy}
        message={message}
        creating={creating}
        setCreating={setCreating}
        currentUser={user}
        onOpenWorkspace={() => setViewingLanding(false)}
        onSignOut={signOut}
      />
    );
  }

  // If user is logged in and in workspace:
  if (user) {
    return (
      <>
        {children(user, () => setViewingLanding(true), {
          signOut,
        })}
      </>
    );
  }

  // Not logged in: show landing page
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
