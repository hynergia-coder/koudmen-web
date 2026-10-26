import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ISLANDS } from "../lib/data";

export default function Account() {
  const { user, profile, refresh } = useAuth();
  const [f, setF] = useState({ first_name: "", last_name: "", island: "RE", city: "", phone: "" });
  const [pw, setPw] = useState("");
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
    if (!error && pw) {
      const r = await supabase.auth.updateUser({ password: pw });
      if (r.error) return setMsg({ type: "alert", text: "Profil enregistré, mais le mot de passe n'a pas changé (6 caractères minimum)." });
      setPw("");
    }
    setMsg(error ? { type: "alert", text: "Enregistrement impossible. Réessayez." } : { type: "hint", text: "Profil enregistré." });
    refresh();
  };

  return (
    <div className="wrap page narrow">
      <h1>Mon profil</h1>
      <p className="muted" style={{ marginTop: 6 }}>Votre téléphone n'est communiqué qu'à l'autre partie, une fois une demande acceptée.</p>
      <form className="panel form" style={{ marginTop: 18 }} onSubmit={save}>
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
        <label htmlFor="a-pw">Nouveau mot de passe (facultatif)</label>
        <input id="a-pw" type="password" minLength="6" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        {msg.text && <p className={msg.type}>{msg.text}</p>}
        <button className="btn wide">Enregistrer</button>
      </form>
      {profile?.role === "aidant" && <p style={{ marginTop: 16 }}><Link className="link" to="/devenir-aidant">Gérer ma fiche aidant →</Link></p>}
      <p className="muted small" style={{ marginTop: 16 }}>Connecté avec {user?.email}</p>
    </div>
  );
}
