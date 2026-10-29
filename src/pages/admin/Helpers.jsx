import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ISLANDS, initials, money, serviceLabel } from "../../lib/data";

function Review({ h, onDone }) {
  const [checks, setChecks] = useState(h.checks?.length ? h.checks : []);
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);
  const options = ISLANDS[h.island].checks;
  const required = options[0]; // le premier contrôle de la liste (en principe l'identité) est obligatoire

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
        <button className="btn sm" disabled={busy || (required && !checks.includes(required))} onClick={() => decide("verified")}>Valider la fiche</button>
        <button className="btn sm line" disabled={busy} onClick={() => decide("rejected")}>Refuser</button>
        {h.status !== "pending" && <button className="btn sm line" disabled={busy} onClick={() => decide("pending")}>Remettre en attente</button>}
      </div>
      {required && !checks.includes(required) && <p className="muted small" style={{ marginTop: 6 }}>Cochez au minimum « {required} » pour valider.</p>}
    </div>
  );
}

export default function Helpers() {
  const [status, setStatus] = useState("pending");
  const [list, setList] = useState(null);

  const load = useCallback(() => {
    supabase.from("helpers").select("*").eq("status", status).order("created_at").then(({ data }) => setList(data || []));
  }, [status]);
  useEffect(() => { setList(null); load(); }, [load]);

  return (
    <>
      <p className="muted">Contrôlez les documents avec l'aidant (rendez-vous ou visio), cochez ce qui a été vérifié, puis validez. Ne stockez pas les documents.</p>
      <div className="chips-sel" style={{ marginTop: 12 }} role="group" aria-label="Statut des fiches">
        {[["pending", "À vérifier"], ["verified", "Vérifiées"], ["rejected", "Refusées"]].map(([k, l]) => (
          <button key={k} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {list === null && <p className="muted" style={{ marginTop: 16 }}>Chargement…</p>}
      {list?.length === 0 && <p className="muted" style={{ marginTop: 16 }}>Aucune fiche dans cette catégorie.</p>}
      <div className="admin-grid">{list?.map((h) => <Review key={h.id} h={h} onDone={load} />)}</div>
    </>
  );
}
