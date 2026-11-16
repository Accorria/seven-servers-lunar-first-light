"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";

export function AccountPanel({
  variant,
  onContinue,
  onGuest,
}: {
  variant: "welcome" | "header";
  onContinue?: () => void;
  onGuest?: () => void;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(variant === "welcome");
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const judge = auth.profile?.permissions.includes("judge");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.configured) {
      setMessage("Accounts are not configured.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const displayName = String(form.get("name") || "");
    setBusy(true);
    const result = mode === "register" ? await auth.signUp(displayName, email, password) : await auth.signIn(email, password);
    setBusy(false);
    setMessage(result.message);
    if (result.ok && result.message !== "Confirm your email, then sign in.") onContinue?.();
  }

  if (!auth.ready && variant === "header") return null;

  if (variant === "header" && auth.authenticated) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{auth.profile?.full_name || "Signed in"}</span>
        {judge && <span className="rounded border border-[var(--cyan)] px-2 py-0.5 text-xs text-[var(--cyan)]">Judge</span>}
        <button type="button" className="rounded border border-[var(--line)] px-2 py-1" onClick={() => void auth.signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  const form = (
    <form className="space-y-2 text-sm" onSubmit={submit}>
      {!auth.configured && <p className="text-[var(--muted)]">Accounts are not configured.</p>}
      <div className="flex gap-2">
        <button type="button" className="rounded border border-[var(--line)] px-2 py-1" onClick={() => setMode("sign-in")}>
          Sign in
        </button>
        <button type="button" className="rounded border border-[var(--line)] px-2 py-1" onClick={() => setMode("register")}>
          Register
        </button>
      </div>
      {mode === "register" && (
        <input name="name" required maxLength={80} placeholder="Display name" autoComplete="name" className="w-full rounded border border-[var(--line)] bg-black/40 px-2 py-1" />
      )}
      <input name="email" type="email" required placeholder="Email" autoComplete="email" className="w-full rounded border border-[var(--line)] bg-black/40 px-2 py-1" />
      <input name="password" type="password" required minLength={8} placeholder="Password" autoComplete={mode === "register" ? "new-password" : "current-password"} className="w-full rounded border border-[var(--line)] bg-black/40 px-2 py-1" />
      <button type="submit" disabled={busy} className="rounded bg-[var(--gold)] px-2 py-1 text-black disabled:opacity-40">
        {mode === "register" ? "Create account" : "Sign in"}
      </button>
      {message && <p className="text-xs text-[var(--muted)]">{message}</p>}
    </form>
  );

  if (variant === "header") {
    return (
      <div className="text-sm">
        <button type="button" className="rounded border border-[var(--line)] px-2 py-1" onClick={() => setOpen((value) => !value)}>
          Sign in
        </button>
        {open && <div className="absolute right-4 z-40 mt-2 w-72 rounded border border-[var(--line)] bg-[var(--panel)] p-3">{form}</div>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-4 rounded border border-[var(--line)] bg-[var(--panel)] p-4">
      <h2 className="text-xl text-[var(--gold)]">Continue</h2>
      {auth.authenticated && (
        <button type="button" className="rounded bg-[var(--gold)] px-3 py-2 text-sm text-black" onClick={onContinue}>
          Continue as {auth.profile?.full_name || "signed in"}
        </button>
      )}
      {form}
      <button type="button" className="rounded border border-[var(--cyan)] px-3 py-2 text-sm text-[var(--cyan)]" onClick={onGuest}>
        Continue as guest
      </button>
    </div>
  );
}
