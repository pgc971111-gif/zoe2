"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type AuthResult = { error: string | null; needsEmailConfirmation?: boolean };
type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Render the login form immediately on the server; session restoration can update it afterward.
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    try {
      const client = getSupabaseBrowserClient();
      const loadingTimeout = setTimeout(() => {
        if (!mounted) return;
        setConfigError("Supabase tardó demasiado en comprobar la sesión. Revisa la conexión e inténtalo de nuevo.");
        setLoading(false);
      }, 5000);

      client.auth.getSession().then(({ data, error }) => {
        if (!mounted) return;
        if (error) setConfigError("No se pudo leer la sesión de Supabase.");
        setSession(data.session);
        setLoading(false);
      }).catch(() => {
        if (!mounted) return;
        setConfigError("No se pudo comprobar la sesión de Supabase.");
        setSession(null);
        setLoading(false);
      }).finally(() => {
        clearTimeout(loadingTimeout);
      });

      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        setLoading(false);
      });

      return () => {
        mounted = false;
        clearTimeout(loadingTimeout);
        data.subscription.unsubscribe();
      };
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Supabase no está configurado.");
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "No se pudo iniciar sesión." };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/integraciones` },
      });
      return {
        error: error?.message ?? null,
        needsEmailConfirmation: !error && !data.session,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "No se pudo crear la cuenta." };
    }
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      return { error: error?.message ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "No se pudo cerrar sesión." };
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, configError, signIn, signUp, signOut }),
    [session, loading, configError, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useSupabaseAuth debe usarse dentro de SupabaseAuthProvider.");
  return context;
}
