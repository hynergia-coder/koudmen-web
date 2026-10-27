import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ISLANDS } from "../lib/data";

// Changement de mot de passe : formulaire indépendant du profil
function PasswordForm({ highlight, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const save = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return setMsg({ type: "alert", text: "Le mot de passe doit faire au moins 6 caractères." });
    if (pw !== pw2) return setMsg({ type: "alert", text: "Les deux mots de passe ne sont pas identiques." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMsg({ type: "alert", text: error.message.toLowerCase().includes("different")
        ? "Choisissez un mot de passe différent de l'ancien."
        : "Le mot de passe n'a pas pu être changé. Réessayez dans quelques minutes." });
      return;
    }
    setPw(""); setPw2("");
    setMsg({ type: "hint", text: "Mot de passe changé. Utilisez-le pour vos prochaines connexions." });
    onDone?.();
  };

  return (
    <form className={"panel form" + (highlight ? " recovery" : "")} style={{ marginTop: 18 }} onSubmit={save}>
      <h2 style={{ fontSize: 18 }}>{highlight ? "Choisissez votre nouveau mot de passe" : "Changer de mot de passe"}</h2>
      {highlight && <p className="muted small" style={{ marginTop: 6 }}>Vous êtes connecté grâce au lien reçu par e-mail. Choisissez un nouveau mot de passe pour vos prochaines connexions.</p>}
      <label htmlFor="pw-1">Nouveau mot de passe</label>
      <input id="pw-1" type="password" minLength="6" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required autoFocus={highlight} />
      <label htmlFor="pw-2">Confirmer le mot de passe</label>
      <input id="pw-2" type="password" minLength="6" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
      {msg.text && <p className={msg.type}>{msg.text}</p>}
      <button className="btn wide" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le mot de passe"}</button>
    </form>
  );
}

export default function Account() {
  const { user, profile, refresh, recovery, setRecovery } = useAuth();
  const [f, setF] = useState({ first_name: "", last_name: "", island: "RE", city: "", phone: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    if (profile) setF({
      first_name: profile.first_name || "", last_name: profile.last_name || "",
      island: profile.island || "RE", city: profile.city || "", phone: profile.phone || "",
    });
  }, [profile]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === "island" ? { city: "" } : {}) });

  const save = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({
      first_name: f.first_name.trim(), last_name: f.last_name.trim(), island: f.island, city: f.city, phone: f.phone.trim(),
    }).eq("id", user.id);
    setMsg(error ? { type: "alert", text: "Enregistrement impossible. Réessayez." } : { type: "hint", text: "Profil enregistré." });
    refresh();
  };

  return (
    <div className="wrap page narrow">
      <h1>Mon profil</h1>

      {recovery && <PasswordForm highlight onDone={() => setRecovery(false)} />}

      <p className="muted" style={{ marginTop: 18 }}>Votre téléphone n'est communiqué qu'à l'autre partie, une fois une demande acceptée.</p>
      <form className="panel form" style={{ marginTop: 12 }} onSubmit={save}>
        <div className="two">
          <div><label htmlFor="a-fn">Prénom</label><input id="a-fn" value={f.first_name} onChange={set("first_name")} required /></div>
          <div><label htmlFor="a-ln">Nom</label><input id="a-ln" value={f.last_name} onChange={set("last_name")} required /></div>
        </div>
        <div className="two">
          <div>
            <label htmlFor="a-isle">Île</label>
            <select id="a-isle" value={f.island} onChange={set("island")}>
              {Object.entries(ISLANDS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-city">Commune</label>
            <select id="a-city" value={f.city} onChange={set("city")} required>
              <option value="">Choisir…</option>
              {ISLANDS[f.island].cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <label htmlFor="a-tel">Téléphone (WhatsApp)</label>
        <input id="a-tel" type="tel" value={f.phone} onChange={set("phone")} placeholder={ISLANDS[f.island].phone} required autoComplete="tel" />
        {msg.text && <p className={msg.type}>{msg.text}</p>}
        <button className="btn wide">Enregistrer le profil</button>
      </form>

      {!recovery && <PasswordForm />}

      {profile?.role === "aidant" && <p style={{ marginTop: 16 }}><Link className="link" to="/devenir-aidant">Gérer ma fiche aidant →</Link></p>}
      <p className="muted small" style={{ marginTop: 16 }}>Connecté avec {user?.email}</p>
    </div>
  );
}
