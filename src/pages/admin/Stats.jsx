import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { cents } from "../../lib/data";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const label = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];

function Bars({ title, data, field, format = (v) => v, accent }) {
  const max = Math.max(1, ...data.map((m) => Number(m[field]) || 0));
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="bars" role="img" aria-label={`${title} sur 6 mois`}>
        {data.map((m, i) => {
          const v = Number(m[field]) || 0;
          return (
            <div key={m.month} className="bar-col">
              <span className="bar-val num">{v ? format(v) : ""}</span>
              <div className={"vbar" + (i === data.length - 1 ? " now" : "") + (accent ? " gold" : "")} style={{ height: `${(v / max) * 100}%` }} />
              <span className="bar-lbl">{label(m.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Stats() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.rpc("admin_stats").then(({ data, error }) => (error ? setErr("Statistiques indisponibles.") : setS(data)));
  }, []);

  if (err) return <p className="alert">{err}</p>;
  if (!s) return <p className="muted">Chargement…</p>;

  const n = (o, k) => Number(o?.[k] || 0);
  const totalUsers = Object.values(s.users).reduce((a, b) => a + Number(b), 0);
  const totalBookings = Object.values(s.bookings).reduce((a, b) => a + Number(b), 0);
  const commission = s.monthly.reduce((a, m) => a + Number(m.commission_eur_cents || 0), 0);

  return (
    <>
      <div className="stats">
        <div className="stat"><span>Comptes</span><b>{totalUsers}</b><small>{n(s.users, "famille")} familles · {n(s.users, "aidant")} aidants · {s.signups_30d} sur 30 jours</small></div>
        <div className="stat"><span>Aidants vérifiés</span><b>{n(s.helpers, "verified")}</b><small>{n(s.helpers, "pending")} fiche{n(s.helpers, "pending") > 1 ? "s" : ""} à vérifier</small></div>
        <div className="stat"><span>Demandes</span><b>{totalBookings}</b><small>{n(s.bookings, "pending")} en attente · {n(s.bookings, "accepted")} acceptées · {n(s.bookings, "done")} terminées</small></div>
        <div className="stat"><span>Commissions (6 mois)</span><b style={{ color: "var(--gold-text)" }}>{cents(commission, "eur")}</b><small>{cents(Number(s.escrow_eur_cents || 0), "eur")} en séquestre</small></div>
      </div>
      <div className="panels">
        <Bars title="Inscriptions par mois" data={s.monthly} field="signups" />
        <Bars title="Demandes par mois" data={s.monthly} field="bookings" />
        <Bars title="Paiements encaissés (€)" data={s.monthly} field="paid_eur_cents" format={(v) => cents(v, "eur").replace(",00", "")} />
        <Bars title="Commissions perçues (€)" data={s.monthly} field="commission_eur_cents" format={(v) => cents(v, "eur").replace(",00", "")} accent />
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>Montants en euros (La Réunion). Les commissions sont comptées au moment du versement à l'aidant.</p>
    </>
  );
}
