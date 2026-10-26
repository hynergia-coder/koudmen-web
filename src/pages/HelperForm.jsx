import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase, callFn } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ISLANDS, SERVICES, LANGUAGES, COMMISSION, money } from "../lib/data";

// Compte de versement Stripe : indispensable pour que les familles puissent payer en ligne
function Payouts({ island }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [p, setP] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      if (params.get("versement") === "retour") {
        const r = await callFn("payment-action", { action: "sync" });
        if (r.data) { setP(r.data); return; }
      }
      const { data } = await supabase.from("helper_payouts").select("details_submitted, payouts_enabled").eq("id", user.id).maybeSingle();
      setP(data || null);
    })();
  }, [user.id, params]);

  const start = async () => {
    setBusy(true); setErr("");
    const { data, error } = await callFn("stripe-onboard", {});
    if (error) { setErr(error); setBusy(false); return; }
    window.location.href = data.url;
  };

  const ready = p?.details_submitted;
  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <h2>Recevoir mes paiements</h2>
      <p className="muted small">
        Les familles paient en ligne. Koudmen conserve l'argent pendant la mission, puis vous le verse sur votre compte bancaire
        {island === "MU" ? " mauricien" : ""}, moins la commission de {COMMISSION * 100} %. L'inscription se fait sur la page sécurisée de Stripe (pièce d'identité et IBAN ou RIB demandés par Stripe, pas par Koudmen).
      </p>
      {p === undefined && <p className="muted" style={{ marginTop: 10 }}>Chargement…</p>}
      {p !== undefined && (ready
        ? <p className="hint">{p.payouts_enabled ? "Compte de versement actif. Les familles peuvent vous payer en ligne." : "Informations envoyées. Stripe vérifie votre compte, les versements seront activés sous peu."}</p>
        : <p className="hint gold-hint">À faire : sans compte de versement, les familles ne peuvent pas vous payer et ne peuvent donc pas confirmer de mission avec vous.</p>)}
      {err && <p className="alert">{err}</p>}
      {p !== undefined && (
        <button className={ready ? "btn line" : "btn gold"} style={{ marginTop: 12 }} disabled={busy} onClick={start}>
          {busy ? "Ouverture de Stripe…" : ready ? "Modifier mes informations de versement" : p ? "Terminer mon inscription Stripe" : "Activer mes versements"}
        </button>
      )}
    </section>
  );
}

const STATUS = {
  pending: { cls: "hint gold-hint", text: "Fiche en cours de vérification. Koudmen vous contacte pour contrôler vos documents ; votre profil devient visible une fois validé." },
  verified: { cls: "hint", text: "Fiche vérifiée et visible par les familles." },
  rejected: { cls: "alert", text: "Fiche non validée. Contactez Koudmen pour en connaître la raison." },
};

export default function HelperForm() {
  const { user, profile, helper, refresh } = useAuth();
  const [f, setF] = useState({ island: "RE", city: "", services: [], rate: "", experience_years: 0, languages: ["Français"], bio: "", available: true });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (helper) setF({
      island: helper.island, city: helper.city, services: helper.services, rate: String(helper.rate),
      experience_years: helper.experience_years, languages: helper.languages, bio: helper.bio, available: helper.available,
    });
    else if (profile) setF((x) => ({ ...x, island: profile.island || "RE", city: profile.city || "" }));
  }, [helper, profile]);

  if (profile && profile.role === "famille" && !helper) {
    const become = async () => {
      await supabase.from("profiles").update({ role: "aidant" }).eq("id", user.id);
      refresh();
    };
    return (
      <div className="wrap page narrow">
        <h1>Devenir aidant·e</h1>
        <p className="muted" style={{ marginTop: 8 }}>Votre compte est un compte famille. Vous pouvez aussi proposer vos services avec le même compte.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={become}>Proposer mes services</button>
      </div>
    );
  }

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === "island" ? { city: "" } : {}) });
  const toggle = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const cur = ISLANDS[f.island].currency;
  const rate = Number(f.rate);

  const save = async (e) => {
    e.preventDefault();
    if (!f.services.length) return setMsg({ type: "alert", text: "Choisissez au moins un service." });
    if (!profile?.first_name) return setMsg({ type: "alert", text: "Renseignez d'abord votre prénom dans Mon profil." });
    setBusy(true);
    const row = {
      id: user.id,
      display_name: `${profile.first_name} ${(profile.last_name || "").slice(0, 1)}.`.trim(),
      island: f.island, city: f.city, services: f.services, rate,
      experience_years: Number(f.experience_years) || 0, languages: f.languages, bio: f.bio.trim(), available: f.available,
    };
    const { error } = helper
      ? await supabase.from("helpers").update(row).eq("id", user.id)
      : await supabase.from("helpers").insert(row);
    setBusy(false);
    setMsg(error ? { type: "alert", text: "Enregistrement impossible. Vérifiez les champs et réessayez." } : { type: "hint", text: helper ? "Fiche mise à jour." : "Fiche envoyée pour vérification." });
    refresh();
  };

  return (
    <div className="wrap page narrow">
      <h1>{helper ? "Ma fiche aidant" : "Créer ma fiche aidant"}</h1>
      {helper && <p className={STATUS[helper.status].cls} style={{ marginTop: 12 }}>{STATUS[helper.status].text}</p>}
      {!helper && <p className="muted" style={{ marginTop: 8 }}>Inscription gratuite. Vous fixez votre tarif et vos horaires. Après envoi, Koudmen vérifie vos documents avec vous (identité, {f.island === "RE" ? "casier judiciaire B3" : "Certificate of Character"}, diplômes) : ils ne sont pas stockés sur la plateforme.</p>}

      <form className="panel form" style={{ marginTop: 18 }} onSubmit={save}>
        <p className="label">Services proposés</p>
        <div className="chips-sel">
          {SERVICES.map((s) => (
            <button type="button" key={s.id} aria-pressed={f.services.includes(s.id)} onClick={() => toggle("services", s.id)}>{s.label}</button>
          ))}
        </div>
        <div className="two">
          <div>
            <label htmlFor="h-isle">Île</label>
            <select id="h-isle" value={f.island} onChange={set("island")}>
              {Object.entries(ISLANDS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="h-city">Commune principale</label>
            <select id="h-city" value={f.city} onChange={set("city")} required>
              <option value="">Choisir…</option>
              {ISLANDS[f.island].cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="two">
          <div><label htmlFor="h-rate">Tarif horaire ({cur})</label><input id="h-rate" type="number" min="1" step={cur === "Rs" ? "10" : "0.5"} value={f.rate} onChange={set("rate")} required /></div>
          <div><label htmlFor="h-exp">Années d'expérience</label><input id="h-exp" type="number" min="0" max="60" value={f.experience_years} onChange={set("experience_years")} /></div>
        </div>
        {rate > 0 && <p className="hint">Pour 1 h à {money(rate, f.island)}, vous recevrez {money(rate * (1 - COMMISSION), f.island)} après la commission de {COMMISSION * 100} %.</p>}
        <p className="label">Langues parlées</p>
        <div className="chips-sel">
          {LANGUAGES.map((l) => <button type="button" key={l} aria-pressed={f.languages.includes(l)} onClick={() => toggle("languages", l)}>{l}</button>)}
        </div>
        <label htmlFor="h-bio">Présentation (visible sur votre profil)</label>
        <textarea id="h-bio" rows="5" maxLength="1200" value={f.bio} onChange={set("bio")} required placeholder="Votre expérience, ce que vous aimez dans ce métier, vos disponibilités habituelles, les quartiers où vous vous déplacez…" />
        <label className="check"><input type="checkbox" checked={f.available} onChange={(e) => setF({ ...f, available: e.target.checked })} /> Disponible pour de nouvelles missions</label>
        {msg.text && <p className={msg.type}>{msg.text}</p>}
        <button className="btn wide" disabled={busy}>{busy ? "Enregistrement…" : helper ? "Mettre à jour ma fiche" : "Envoyer ma fiche"}</button>
      </form>
      {helper && <Payouts island={helper.island} />}
      {helper?.status === "verified" && <p style={{ marginTop: 16 }}><Link className="link" to={`/aidant/${user.id}`}>Voir mon profil public →</Link></p>}
    </div>
  );
}
