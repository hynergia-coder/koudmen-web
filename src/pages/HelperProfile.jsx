import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { initials, money, serviceLabel, ISLANDS } from "../lib/data";

const today = () => new Date().toISOString().slice(0, 10);

export default function HelperProfile() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [h, setH] = useState(undefined);
  const [form, setForm] = useState({ service: "", date: "", start_time: "", hours: 2, message: "" });
  const [state, setState] = useState({ sending: false, done: false, error: "" });

  useEffect(() => {
    supabase.from("helpers").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setH(data || null);
      if (data) setForm((f) => ({ ...f, service: data.services[0] || "" }));
    });
  }, [id]);

  if (h === undefined) return <div className="wrap page"><p className="muted">Chargement…</p></div>;
  if (h === null) return (
    <div className="wrap page">
      <h1>Profil introuvable</h1>
      <p className="muted" style={{ marginTop: 8 }}>Ce profil n'existe pas ou n'est pas encore vérifié.</p>
      <Link className="btn" style={{ marginTop: 16 }} to="/">Retour à la recherche</Link>
    </div>
  );

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isSelf = user?.id === h.id;
  const profileReady = profile?.first_name && profile?.phone;
  const total = Number(h.rate) * Number(form.hours || 0);

  const send = async (e) => {
    e.preventDefault();
    if (!user) return nav("/connexion");
    setState({ sending: true, done: false, error: "" });
    const { error } = await supabase.from("bookings").insert({
      family_id: user.id, helper_id: h.id, service: form.service, date: form.date,
      start_time: form.start_time || null, hours: Number(form.hours), message: form.message.trim(),
    });
    setState(error
      ? { sending: false, done: false, error: "La demande n'a pas pu être envoyée. Vérifiez la date et réessayez." }
      : { sending: false, done: true, error: "" });
  };

  return (
    <div className="wrap page profile">
      <Link to="/" className="link">← Retour à la recherche</Link>
      <div className="profile-grid">
        <div className="panel">
          <div className="who">
            <div className="av lg" aria-hidden="true">{initials(h.display_name)}</div>
            <div>
              <h1 style={{ fontSize: 26 }}>{h.display_name}</h1>
              <div className="meta">{h.city} · {ISLANDS[h.island].name}</div>
              <div className="meta">{h.experience_years} an{h.experience_years > 1 ? "s" : ""} d'expérience</div>
            </div>
          </div>
          <p style={{ marginTop: 16, whiteSpace: "pre-line" }}>{h.bio}</p>
          <h3 className="h-sm">Services</h3>
          <div className="badges">{h.services.map((s) => <span className="badge" key={s}>{serviceLabel(s)}</span>)}</div>
          <h3 className="h-sm">Vérifications</h3>
          <div className="badges">
            {h.checks.length ? h.checks.map((c) => <span className="badge" key={c}>✓ {c}</span>) : <span className="muted">Profil vérifié par Koudmen</span>}
          </div>
          {h.languages.length > 0 && <>
            <h3 className="h-sm">Langues</h3>
            <div className="badges">{h.languages.map((l) => <span className="badge g" key={l}>{l}</span>)}</div>
          </>}
        </div>

        <div className="panel book">
          <p className="rate big">{money(h.rate, h.island)}<small> /h</small></p>
          {h.payments_ready && <p className="badges" style={{ marginBottom: 12 }}><span className="badge">Paiement en ligne sécurisé</span></p>}
          {isSelf ? (
            <p className="muted">C'est votre profil public. <Link to="/devenir-aidant" className="link">Le modifier</Link></p>
          ) : state.done ? (
            <div>
              <h2 style={{ fontSize: 20 }}>Demande envoyée</h2>
              <p className="muted" style={{ marginTop: 6 }}>{h.display_name.split(" ")[0]} va l'examiner. Vous verrez sa réponse et ses coordonnées dans votre tableau de bord.</p>
              <Link className="btn" style={{ marginTop: 14 }} to="/tableau-de-bord">Voir mes demandes</Link>
            </div>
          ) : !user ? (
            <>
              <p className="muted">Connectez-vous pour envoyer une demande à {h.display_name.split(" ")[0]}.</p>
              <Link className="btn" style={{ marginTop: 12 }} to="/connexion">Se connecter ou créer un compte</Link>
            </>
          ) : !h.payments_ready ? (
            <p className="hint gold-hint">{h.display_name.split(" ")[0]} finalise son compte de paiement en ligne. Les demandes seront ouvertes très bientôt.</p>
          ) : !profileReady ? (
            <>
              <p className="muted">Complétez votre prénom et votre téléphone avant d'envoyer une demande : l'aidant en aura besoin pour vous contacter.</p>
              <Link className="btn" style={{ marginTop: 12 }} to="/mon-profil">Compléter mon profil</Link>
            </>
          ) : (
            <form onSubmit={send} className="form">
              <label htmlFor="b-svc">Service</label>
              <select id="b-svc" value={form.service} onChange={set("service")} required>
                {h.services.map((s) => <option key={s} value={s}>{serviceLabel(s)}</option>)}
              </select>
              <div className="two">
                <div><label htmlFor="b-date">Date</label><input id="b-date" type="date" min={today()} value={form.date} onChange={set("date")} required /></div>
                <div><label htmlFor="b-time">Heure de début</label><input id="b-time" type="time" value={form.start_time} onChange={set("start_time")} /></div>
              </div>
              <label htmlFor="b-hours">Durée (heures)</label>
              <input id="b-hours" type="number" min="0.5" max="24" step="0.5" value={form.hours} onChange={set("hours")} required />
              <label htmlFor="b-msg">Votre besoin</label>
              <textarea id="b-msg" rows="3" maxLength="800" value={form.message} onChange={set("message")} placeholder="Ex. garde de 2 enfants (4 et 7 ans), sortie d'école puis devoirs" />
              {total > 0 && <p className="hint">Estimation : {money(total, h.island)} pour {form.hours} h.</p>}
              {state.error && <p className="alert">{state.error}</p>}
              <button className="btn wide" disabled={state.sending}>{state.sending ? "Envoi…" : "Envoyer ma demande"}</button>
              <p className="muted small center">Aucun paiement maintenant. Vous paierez en ligne une fois la demande acceptée ; Koudmen conserve l'argent jusqu'à ce que vous confirmiez la fin de la mission.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
