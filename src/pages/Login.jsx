import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function Login() {
  const [params] = useSearchParams();
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState(params.get("mode") === "aidant" ? "signup" : "login");
  const [role, setRole] = useState(params.get("mode") === "aidant" ? "aidant" : "famille");
  const [f, setF] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && profile) nav(profile.role === "aidant" ? "/devenir-aidant" : "/tableau-de-bord", { replace: true });
  }, [user, profile, nav]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg({ type: "", text: "" });
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) setMsg({ type: "alert", text: "E-mail ou mot de passe incorrect." });
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: f.email, password: f.password,
        options: { data: { role, first_name: f.first_name.trim(), last_name: f.last_name.trim() }, emailRedirectTo: window.location.origin + "/connexion" },
      });
      if (error) setMsg({ type: "alert", text: error.message.includes("registered") ? "Un compte existe déjà avec cet e-mail. Connectez-vous." : "L'inscription a échoué. Le mot de passe doit faire au moins 6 caractères." });
      else if (!data.session) setMsg({ type: "hint", text: "Compte créé. Ouvrez l'e-mail de confirmation que nous venons d'envoyer, puis connectez-vous." });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin + "/mon-profil" });
      setMsg(error ? { type: "alert", text: "Envoi impossible. Vérifiez l'adresse e-mail." } : { type: "hint", text: "Si un compte existe, un lien de réinitialisation vient d'être envoyé." });
    }
    setBusy(false);
  };

  return (
    <div className="wrap page narrow">
      <div className="panel">
        <div className="subtabs" role="group" aria-label="Connexion ou inscription">
          <button aria-pressed={mode === "login"} onClick={() => setMode("login")}>Se connecter</button>
          <button aria-pressed={mode === "signup"} onClick={() => setMode("signup")}>Créer un compte</button>
        </div>
        <form className="form" onSubmit={submit}>
          {mode === "signup" && (
            <>
              <p className="label">Vous êtes</p>
              <div className="choice" role="group" aria-label="Type de compte">
                <button type="button" aria-pressed={role === "famille"} onClick={() => setRole("famille")}><b>Une famille</b><span>Je cherche de l'aide</span></button>
                <button type="button" aria-pressed={role === "aidant"} onClick={() => setRole("aidant")}><b>Un·e aidant·e</b><span>Je propose mes services</span></button>
              </div>
              <div className="two">
                <div><label htmlFor="l-fn">Prénom</label><input id="l-fn" value={f.first_name} onChange={set("first_name")} required autoComplete="given-name" /></div>
                <div><label htmlFor="l-ln">Nom</label><input id="l-ln" value={f.last_name} onChange={set("last_name")} required autoComplete="family-name" /></div>
              </div>
            </>
          )}
          <label htmlFor="l-mail">E-mail</label>
          <input id="l-mail" type="email" value={f.email} onChange={set("email")} required autoComplete="email" />
          {mode !== "reset" && <>
            <label htmlFor="l-pw">Mot de passe</label>
            <input id="l-pw" type="password" minLength="6" value={f.password} onChange={set("password")} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </>}
          {msg.text && <p className={msg.type}>{msg.text}</p>}
          <button className="btn wide" disabled={busy}>
            {busy ? "Patientez…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Recevoir le lien"}
          </button>
          {mode === "login" && <button type="button" className="link center" onClick={() => setMode("reset")}>Mot de passe oublié ?</button>}
          {mode === "reset" && <button type="button" className="link center" onClick={() => setMode("login")}>Retour à la connexion</button>}
        </form>
      </div>
    </div>
  );
}
