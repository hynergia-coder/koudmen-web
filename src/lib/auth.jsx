import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [helper, setHelper] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s) => {
    if (!s) { setProfile(null); setHelper(null); return; }
    const uid = s.user.id;
    const [{ data: p }, { data: h }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("helpers").select("*").eq("id", uid).maybeSingle(),
    ]);
    setProfile(p || null);
    setHelper(h || null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refresh = () => loadProfile(session);
  const signOut = () => supabase.auth.signOut();

  return (
    <AuthCtx.Provider value={{ session, user: session?.user, profile, helper, loading, refresh, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
