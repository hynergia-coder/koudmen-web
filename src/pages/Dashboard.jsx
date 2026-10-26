import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase, callFn } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { STATUS_LABEL, PAYMENT_LABEL, fmtDate, money, cents, serviceLabel, waLink, COMMISSION } from "../lib/data";

function Contact({ id }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    supabase.rpc("booking_contact", { b: id }).then(({ data }) => setC(data?.[0] || null));
  }, [id]);
  if (!c?.phone) return null;
  const wa = waLink(c.phone);
  return (
    <div className="contact">
      <span>{c.first_name} · <b className="num">{c.phone}</b></span>
      {wa && <a className="btn sm gold" href={wa} target="_blank" rel="noopener">WhatsApp</a>}
    </div>
  );
}

function FamilyName({ id }) {
  const [n, setN] = useState("");
  useEffect(() => { supabase.rpc("booking_family_name", { b: id }).then(({ data }) => setN(data || "")); }, [id]);
  return <>{n || "Famille"}</>;
}

export function Booking({ b, asHelper, asAdmin, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(null); // action en attente de confirmation

  const move = async (status) => {
    setBusy(true); setErr("");
    const { error } = await supabase.from("bookings").update({ status }).eq("id", b.id);
    setBusy(false);
    if (error) setErr(error.message.includes("payée") ? error.message : "Action impossible pour le moment.");
    else onChange();
  };
  const pay = async () => {
    setBusy(true); setErr("");
    const { data, error } = await callFn("create-checkout", { booking_id: b.id });
    if (error) { setErr(error); setBusy(false); return; }
    window.location.href = data.url;
  };
  const act = async (action) => {
    setBusy(true); setErr(""); setConfirm(null);
    const { error } = await callFn("payment-action", { action, booking_id: b.id });
    setBusy(false);
    if (error) setErr(error); else onChange();
  };

  const island = b.helpers?.island;
  const total = b.amount_cents ? cents(b.amount_cents, b.currency) : b.helpers ? money(Number(b.helpers.rate) * Number(b.hours), island) : null;
  const paid = b.payment_status === "paid";
  const showPay = ["accepted", "done", "pending"].includes(b.status) || b.payment_status !== "unpaid";

  return (
    <div className="req">
      <div className="txt">
        <div className="req-top">
          <b>{asHelper || asAdmin ? <FamilyName id={b.id} /> : b.helpers?.display_name || "Aidant"}</b>
          {asAdmin && <span className="muted small">→ {b.helpers?.display_name}</span>}
          <span className={"pill " + b.status}>{STATUS_LABEL[b.status]}</span>
          {showPay && b.status !== "pending" && <span className={"pill pay-" + b.payment_status}>{PAYMENT_LABEL[b.payment_status]}</span>}
        </div>
        <div className="req-line">{serviceLabel(b.service)} · {fmtDate(b.date)}{b.start_time ? ` · ${b.start_time.slice(0, 5)}` : ""} · {b.hours} h</div>
        {b.message && <p className="muted small" style={{ marginTop: 4 }}>{b.message}</p>}
        {total && <p className="small num" style={{ marginTop: 4 }}>Montant : <b>{total}</b>
          {asHelper && b.payment_status !== "released" && b.amount_cents ? ` · vous recevrez environ ${cents(Math.floor(b.amount_cents * (1 - COMMISSION)), b.currency)}` : ""}
          {b.payment_status === "released" && b.helper_payout_cents ? ` · versé à l'aidant : ${cents(b.helper_payout_cents, b.payout_currency)}` : ""}
        </p>}

        {/* Messages d'état côté famille */}
        {!asHelper && !asAdmin && b.status === "accepted" && b.payment_status !== "paid" && (
          <p className="hint small">Demande acceptée. Payez en ligne pour confirmer la mission : l'argent est conservé par Koudmen et versé à l'aidant seulement après votre confirmation.</p>
        )}
        {!asHelper && !asAdmin && b.status === "done" && paid && (
          <p className="hint gold-hint small">L'aidant a indiqué que la mission est terminée. Confirmez pour lui verser le paiement. En cas de problème, contactez Koudmen avant de confirmer.</p>
        )}
        {/* Messages d'état côté aidant */}
        {asHelper && b.status === "accepted" && !paid && <p className="hint gold-hint small">En attente du paiement en ligne de la famille.</p>}
        {asHelper && b.status === "accepted" && paid && <p className="hint small">Paiement reçu et sécurisé par Koudmen. Après la mission, marquez-la terminée.</p>}
        {asHelper && b.status === "done" && paid && <p className="hint small">En attente de la confirmation de la famille pour le versement.</p>}

        {["accepted", "done"].includes(b.status) && !asAdmin && <Contact id={b.id} />}
        {err && <p className="alert small">{err}</p>}
        {confirm && (
          <div className="confirm">
            <p className="small">{confirm === "release"
              ? `Confirmer que la mission s'est bien déroulée et verser le paiement à l'aidant ? Cette action est définitive.`
              : `Annuler la mission et rembourser intégralement ${total} ?`}</p>
            <div className="act">
              <button className="btn sm" disabled={busy} onClick={() => act(confirm)}>{confirm === "release" ? "Oui, verser le paiement" : "Oui, annuler et rembourser"}</button>
              <button className="btn sm line" disabled={busy} onClick={() => setConfirm(null)}>Retour</button>
            </div>
          </div>
        )}
      </div>

      {!confirm && (
        <div className="act">
          {asHelper && b.status === "pending" && <>
            <button className="btn sm" disabled={busy} onClick={() => move("accepted")}>Accepter</button>
            <button className="btn sm line" disabled={busy} onClick={() => move("declined")}>Refuser</button>
          </>}
          {asHelper && b.status === "accepted" && paid && <button className="btn sm line" disabled={busy} onClick={() => move("done")}>Marquer terminée</button>}

          {!asHelper && !asAdmin && b.status === "accepted" && !paid && <button className="btn sm gold" disabled={busy} onClick={pay}>{busy ? "Ouverture…" : `Payer ${total} en ligne`}</button>}
          {!asHelper && !asAdmin && b.status === "done" && paid && <button className="btn sm" disabled={busy} onClick={() => setConfirm("release")}>Confirmer la mission</button>}
          {!asHelper && !asAdmin && ["pending", "accepted"].includes(b.status) && !paid && <button className="btn sm line" disabled={busy} onClick={() => move("cancelled")}>Annuler</button>}
          {!asHelper && !asAdmin && b.status === "accepted" && paid && <button className="btn sm line" disabled={busy} onClick={() => setConfirm("refund")}>Annuler et être remboursé</button>}

          {asAdmin && paid && <>
            <button className="btn sm" disabled={busy} onClick={() => setConfirm("release")}>Verser à l'aidant</button>
            <button className="btn sm line" disabled={busy} onClick={() => setConfirm("refund")}>Rembourser la famille</button>
          </>}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, helper } = useAuth();
  const [params, setParams] = useSearchParams();
  const [received, setReceived] = useState(null);
  const [sent, setSent] = useState(null);
  const payReturn = params.get("paiement");

  const load = useCallback(async () => {
    const sel = "*, helpers(display_name, island, city, rate)";
    const [r, s] = await Promise.all([
      helper ? supabase.from("bookings").select(sel).eq("helper_id", user.id).order("date") : Promise.resolve({ data: [] }),
      supabase.from("bookings").select(sel).eq("family_id", user.id).order("created_at", { ascending: false }),
    ]);
    setReceived(r.data || []);
    setSent(s.data || []);
  }, [user, helper]);

  useEffect(() => { load(); }, [load]);
  // Retour de Stripe : la confirmation arrive quelques secondes après, on recharge
  useEffect(() => {
    if (payReturn !== "ok") return;
    const t1 = setTimeout(load, 3000), t2 = setTimeout(load, 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [payReturn, load]);

  const pending = received?.filter((b) => b.status === "pending").length || 0;
  const active = received?.filter((b) => b.status === "accepted").length || 0;
  const released = received?.filter((b) => b.payment_status === "released") || [];
  const inEscrow = received?.filter((b) => b.payment_status === "paid") || [];
  const sumCents = (list) => list.reduce((s, b) => s + (b.helper_payout_cents ?? Math.floor((b.amount_cents || 0) * (1 - COMMISSION))), 0);
  const cur = helper?.island === "MU" ? "mur" : "eur";

  return (
    <div className="wrap page">
      <h1>Bonjour {profile?.first_name || ""}</h1>
      {payReturn && (
        <p className={payReturn === "ok" ? "hint" : "alert"} style={{ marginTop: 12 }}>
          {payReturn === "ok"
            ? "Paiement effectué. Il est conservé par Koudmen jusqu'à votre confirmation de fin de mission. Le statut se met à jour dans quelques secondes."
            : "Paiement non finalisé. Vous pouvez réessayer depuis la demande concernée."}
          {" "}<button className="link" onClick={() => setParams({})}>Masquer</button>
        </p>
      )}
      {(!profile?.phone || !profile?.city) && (
        <p className="hint gold-hint" style={{ marginTop: 12 }}>Complétez votre profil (commune et téléphone) pour envoyer ou recevoir des demandes. <Link className="link" to="/mon-profil">Compléter</Link></p>
      )}

      {helper && (
        <>
          <div className="stats">
            <div className="stat"><span>Demandes en attente</span><b>{pending}</b></div>
            <div className="stat"><span>Missions acceptées</span><b>{active}</b></div>
            <div className="stat"><span>En séquestre</span><b>{inEscrow.length ? cents(sumCents(inEscrow), cur) : "—"}</b><small>versé après confirmation</small></div>
            <div className="stat"><span>Déjà versé</span><b>{released.length ? cents(sumCents(released), released[0].payout_currency || "eur") : "—"}</b><small>{released.length} mission{released.length > 1 ? "s" : ""}</small></div>
          </div>
          <section className="panel" style={{ marginTop: 16 }}>
            <h2>Demandes reçues</h2>
            {received === null && <p className="muted">Chargement…</p>}
            {received?.length === 0 && <p className="muted">Aucune demande pour l'instant. {helper.status !== "verified" && "Elles arriveront une fois votre fiche vérifiée."}</p>}
            {received?.map((b) => <Booking key={b.id} b={b} asHelper onChange={load} />)}
          </section>
        </>
      )}

      {profile?.role === "aidant" && !helper && (
        <p className="hint" style={{ marginTop: 16 }}>Vous n'avez pas encore de fiche aidant. <Link className="link" to="/devenir-aidant">La créer</Link></p>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Mes demandes envoyées</h2>
        {sent === null && <p className="muted">Chargement…</p>}
        {sent?.length === 0 && <p className="muted">Vous n'avez envoyé aucune demande. <Link className="link" to="/">Trouver un aidant</Link></p>}
        {sent?.map((b) => <Booking key={b.id} b={b} onChange={load} />)}
      </section>
    </div>
  );
}
