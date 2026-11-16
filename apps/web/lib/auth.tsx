"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export type Profile = {
  full_name: string;
  role: string;
  permissions: string[];
  mission_specialist_id: string;
};

type SessionPayload = {
  configured: boolean;
  authenticated: boolean;
  email?: string | null;
  profile?: Profile | null;
};

export type AuthResult = { ok: boolean; message: string };

type AuthControls = {
  ready: boolean;
  configured: boolean;
  authenticated: boolean;
  email: string | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (displayName: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthControls | null>(null);

const UNCONFIGURED = "Accounts are not configured.";

function asProfile(value: Profile | null | undefined): Profile | null {
  if (!value?.full_name) return null;
  return {
    full_name: value.full_name,
    role: value.role,
    permissions: Array.isArray(value.permissions) ? value.permissions : [],
    mission_specialist_id: value.mission_specialist_id,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const apply = useCallback((payload: SessionPayload) => {
    setConfigured(Boolean(payload.configured));
    setAuthenticated(Boolean(payload.authenticated));
    setEmail(payload.email ?? null);
    setProfile(payload.authenticated ? asProfile(payload.profile) : null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      apply((await response.json()) as SessionPayload);
    } catch {
      apply({ configured: false, authenticated: false });
    } finally {
      setReady(true);
    }
  }, [apply]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const signIn = useCallback(async (emailAddress: string, password: string): Promise<AuthResult> => {
    const supabase = createSupabaseBrowser();
    if (!supabase) return { ok: false, message: UNCONFIGURED };
    const { error } = await supabase.auth.signInWithPassword({ email: emailAddress.trim(), password });
    if (error) return { ok: false, message: error.message };
    await refresh();
    return { ok: true, message: "Signed in." };
  }, [refresh]);

  const signUp = useCallback(async (displayName: string, emailAddress: string, password: string): Promise<AuthResult> => {
    const supabase = createSupabaseBrowser();
    if (!supabase) return { ok: false, message: UNCONFIGURED };
    const fullName = displayName.trim().slice(0, 80);
    if (!fullName) return { ok: false, message: "Enter a display name." };
    const { data, error } = await supabase.auth.signUp({
      email: emailAddress.trim(),
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { ok: false, message: error.message };
    await refresh();
    if (!data.session) return { ok: true, message: "Confirm your email, then sign in." };
    return { ok: true, message: "Account created." };
  }, [refresh]);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowser();
    if (supabase) await supabase.auth.signOut();
    await refresh();
  }, [refresh]);

  const value = useMemo<AuthControls>(() => ({
    ready,
    configured,
    authenticated,
    email,
    profile,
    signIn,
    signUp,
    signOut,
    refresh,
  }), [authenticated, configured, email, profile, ready, refresh, signIn, signOut, signUp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth is unavailable");
  return value;
}
