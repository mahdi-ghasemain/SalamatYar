import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Session } from "@supabase/supabase-js";
import { backendConfigured, requireBackend, supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();
export const redirectUrl = () =>
  Platform.OS === "web"
    ? `${window.location.origin}/auth/callback`
    : "salamatyar://auth/callback";
const completed = new Map<string, Promise<void>>();
export function completeAuth(url: string): Promise<void> {
  const parsed = new URL(url);
  const error = parsed.searchParams.get("error_description");
  if (error) return Promise.reject(new Error(error));
  const code = parsed.searchParams.get("code");
  if (!code)
    return Promise.reject(new Error("No authentication code was returned."));
  if (!completed.has(code))
    completed.set(
      code,
      (async () => {
        const { error } =
          await requireBackend().auth.exchangeCodeForSession(code);
        if (error) throw error;
      })(),
    );
  return completed.get(code)!;
}
type Auth = {
  session: Session | null;
  ready: boolean;
  configured: boolean;
  recovery: boolean;
  error: string;
  signOut: () => Promise<void>;
  setRecovery: (value: boolean) => void;
};
const Context = createContext<Auth>({
  session: null,
  ready: false,
  configured: backendConfigured,
  recovery: false,
  error: "",
  signOut: async () => {},
  setRecovery: () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (alive) {
        setSession(next);
        setReady(true);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive) {
          if (error) setError(error.message);
          setSession(data.session);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) {
          setError("Session could not be restored.");
          setReady(true);
        }
      });
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  async function signOut() {
    const { error } = await requireBackend().auth.signOut({ scope: "local" });
    if (error) throw error;
    setRecovery(false);
  }
  return (
    <Context.Provider
      value={{
        session,
        ready,
        configured: backendConfigured,
        recovery,
        error,
        signOut,
        setRecovery,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
export async function oauth(provider: "google" | "apple") {
  const { data, error } = await requireBackend().auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectUrl(), skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("OAuth URL unavailable.");
  if (Platform.OS === "web") {
    window.location.assign(data.url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl());
  if (result.type === "success") await completeAuth(result.url);
  else throw new Error("Sign-in cancelled.");
}
