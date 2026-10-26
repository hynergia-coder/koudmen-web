import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ISLANDS, initials, money, serviceLabel } from "../lib/data";
import { Booking } from "./Dashboard";

function Review({ h, onDone }) {
  const [checks, setChecks] = useState(h.checks?.length ? h.checks : []);
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);
  const options = ISLANDS[h.island].checks;

  useEffect(() => {
    supabase.from("profiles").select("first_name,last_name,phone,city").eq("id", h.id).maybeSingle().then(({ data }) => setContact(data));
  }, [h.id]);

  const toggle = (c) => setChecks(checks.includes(c) ? checks.filter((x) => x !== c) : [...checks, c]);
  const decide = async (status) => {
    setBusy(true);
    await supabase.from("helpers").update({ status, checks }).eq("id", h.id);
    setBusy(false); onDone();
  };

  return (
    <div className="panel">
      <div className="who">
        <div className="av" aria-hidden="true">{initials(h.display_name)}</div>
        <div>
          <b>{contact ? `${contact.first_name} ${contact.last_name}` : h.display_name}</b>
          <div className="meta">{h.city} · {ISLANDS[h.island].name} · {money(h.rate, h.island)}/h</div>
          {contact?.phone && <div className="meta num">{contact.phone}</div>}
        </div>
        <span className={"pill " + (h.status === "verified" ? "accepted" : h.status === "rejected" ? "declined" : "pending")} style={{ marginLeft: "auto" }}>
          {h.status === "verified" ? "Vérifiée" : h.status === "rejected" ? "Refusée" : "À vérifier"}
        </span>
      </div>
      <p className="small" style={{ marginTop: 10 }}>{h.services.map(serviceLabel).join(" · ")}</p>
      <p className="muted small" style={{ marginTop: 6, whiteSpace: "pre-line" }}>{h.bio}</p>
      <p className="label" style={{ marginTop: 12 }}>Documents contrôlés</p>
      <div className="chips-sel">
        {options.map((c) => <button type="button" key={c} aria-pressed={checks.includes(c)} onClick={() => toggle(c)}>{c}</button>)}
      </div>
      <div className="row-btns">
        <button className="btn sm" disabled={busy || !checks.includes("Identité vérifiée")} onClick={() => decide("verified")}>Valider la fiche</button>
        <button className="btn sm line" disabled={busy} onClick={() => decide("rejected")}>Refuser</button>
        {h.status !== "pending" && <button className="btn sm line" disabled={busy} onClick={() => decide("pending")}>Remettre en attente</button>}
      </div>
      {!checks.includes("Identité vérifiée") && <p className="muted small" style={{ marginTop: 6 }}>Cochez au minimum « Identité vérifiée » pour valider.</p>}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("pending");
  const [list, setList] = useState(null);

  const load = useCallback(() => {
    if (tab === "paiements") {
      supabase.from("bookings").select("*, helpers(display_name, island, city, rate)")
        .in("payment_status", ["paid"]).order("paid_at").then(({ data }) => setList(data || []));
    } else {
      supabase.from("helpers").select("*").eq("status", tab).order("created_at").then(({ data }) => setList(data || []));
    }
  }, [tab]);
  useEffect(() => { setList(null); load(); }, [load]);

  return (
    <div className="wrap page">
      <h1>Administration</h1>
      <p className="muted" style={{ marginTop: 6 }}>Contrôlez les documents avec l'aidant (rendez-vous ou visio), cochez ce qui a été vérifié, puis validez. Ne stockez pas les documents.</p>
      <div className="subtabs" role="group" aria-label="Filtrer les fiches">
        <button aria-pressed={tab === "pending"} onClick={() => setTab("pending")}>À vérifier</button>
        <button aria-pressed={tab === "verified"} onClick={() => setTab("verified")}>Vérifiées</button>
        <button aria-pressed={tab === "rejected"} onClick={() => setTab("rejected")}>Refusées</button>
        <button aria-pressed={tab === "paiements"} onClick={() => setTab("paiements")}>Paiements en séquestre</button>
      </div>
      {tab === "paiements" && <p className="muted small" style={{ marginTop: 12 }}>Missions payées dont l'argent n'est pas encore versé. Intervenez en cas de litige ou si une famille ne confirme pas une mission terminée.</p>}
      {list === null && <p className="muted" style={{ marginTop: 16 }}>Chargement…</p>}
      {list?.length === 0 && <p className="muted" style={{ marginTop: 16 }}>Rien dans cette catégorie.</p>}
      {tab === "paiements"
        ? <section className="panel" style={{ marginTop: 16 }}>{list?.map((b) => <Booking key={b.id} b={b} asAdmin onChange={load} />)}</section>
        : <div className="admin-grid">{list?.map((h) => <Review key={h.id} h={h} onDone={load} />)}</div>}
    </div>
  );
}
