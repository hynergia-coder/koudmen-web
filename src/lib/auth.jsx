import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [helper, setHelper] = useState(null);
  const [loading, setLoading] = useState(true);        // session pas encore connue
  const [profileLoading, setProfileLoading] = useState(false);
  // Arrivée par un lien « mot de passe oublié » : l'app demande un nouveau mot de passe
  const [recovery, setRecovery] = useState(() => window.location.hash.includes("type=recovery"));
  const loadedFor = useRef(null); // utilisateur dont le profil est déjà chargé

  const loadProfile = useCallback(async (uid, force = false) => {
    if (!uid) { loadedFor.current = null; setProfile(null); setHelper(null); return; }
    if (!force && loadedFor.current === uid) return;
    loadedFor.current = uid;
    setProfileLoading(true);
    const [{ data: p }, { data: h }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("helpers").select("*").eq("id", uid).maybeSingle(),
    ]);
    setProfile(p || null);
    setHelper(h || null);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    // Une seule source : l'événement initial de Supabase, puis les changements.
    // Les appels à la base sont décalés hors du callback (recommandation Supabase),
    // sinon ils peuvent bloquer ou déclencher des renouvellements de session en boucle.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
      if (event === "TOKEN_REFRESHED") return; // même utilisateur, rien à recharger
      const uid = s?.user?.id;
      setTimeout(async () => {
        if (!active) return;
        await loadProfile(uid);
        if (active) setLoading(false);
      }, 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const refresh = () => loadProfile(session?.user?.id, true);
  const signOut = async () => { setRecovery(false); await supabase.auth.signOut(); };

  return (
    <AuthCtx.Provider value={{
      session, user: session?.user, profile, helper,
      loading: loading || (!!session && profileLoading && !profile),
      refresh, signOut, recovery, setRecovery,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
