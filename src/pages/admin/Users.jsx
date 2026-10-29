import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { ISLANDS } from "../../lib/data";

const ROLES = { famille: "Famille", aidant: "Aidant·e", admin: "Admin" };
const HELPER = { pending: "fiche à vérifier", verified: "fiche vérifiée", rejected: "fiche refusée" };
const day = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "jamais");

function Row({ u, me, onChange }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { field, value, text }
  const [err, setErr] = useState("");
  const isMe = u.id === me;

  const apply = async (patch) => {
    setBusy(true); setErr(""); setConfirm(null);
    const { error } = await supabase.from("profiles").update(patch).eq("id", u.id);
    setBusy(false);
    if (error) setErr("Modification impossible.");
    else onChange();
  };

  const askRole = (role) => {
    if (role === u.role) return;
    setConfirm({ patch: { role }, text: role === "admin"
      ? `Donner l'accès administrateur à ${u.email} ? Cette personne pourra tout modifier sur Koudmen.`
      : `Passer ${u.email} en « ${ROLES[role]} » ?` });
  };

  return (
    <div className={"user-row" + (u.suspended ? " is-suspended" : "")}>
      <div className="txt">
        <div className="req-top">
          <b>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "Sans nom"}</b>
          <span className="muted small">{u.email}</span>
          {u.suspended && <span className="pill declined">Suspendu</span>}
          {u.helper_status && <span className={"pill " + (u.helper_status === "verified" ? "accepted" : u.helper_status === "rejected" ? "declined" : "pending")}>{HELPER[u.helper_status]}</span>}
        </div>
        <div className="meta">
          {[u.city, u.island && ISLANDS[u.island]?.name, u.phone].filter(Boolean).join(" · ") || "Profil incomplet"}
          {" · "}inscrit le {day(u.created_at)} · dernière connexion : {day(u.last_sign_in_at)}
        </div>
        {err && <p className="alert small">{err}</p>}
        {confirm && (
          <div className="confirm">
            <p className="small">{confirm.text}</p>
            <div className="act">
              <button className="btn sm" disabled={busy} onClick={() => apply(confirm.patch)}>Confirmer</button>
              <button className="btn sm line" onClick={() => setConfirm(null)}>Annuler</button>
            </div>
          </div>
        )}
      </div>
      {!confirm && (
        <div className="act">
          <label className="sr" htmlFor={`role-${u.id}`}>Rôle</label>
          <select id={`role-${u.id}`} className="mini-select" value={u.role} disabled={busy || isMe} onChange={(e) => askRole(e.target.value)}>
            {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {!isMe && (u.suspended
            ? <button className="btn sm line" disabled={busy} onClick={() => apply({ suspended: false })}>Réactiver</button>
            : <button className="btn sm line" disabled={busy} onClick={() => setConfirm({ patch: { suspended: true }, text: `Suspendre ${u.email} ? Ses fiches disparaîtront de la recherche et il ne pourra plus envoyer de demandes.` })}>Suspendre</button>)}
          {isMe && <span className="muted small">C'est vous</span>}
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    supabase.rpc("admin_users").then(({ data, error }) => {
      if (error) setError("Impossible de charger les utilisateurs.");
      else setList(data || []);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (list || []).filter((u) => {
    if (role === "suspendu" ? !u.suspended : role && u.role !== role) return false;
    if (!q) return true;
    const hay = `${u.first_name} ${u.last_name} ${u.email} ${u.city} ${u.phone}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [list, q, role]);

  const counts = useMemo(() => {
    const c = { "": list?.length || 0, suspendu: 0 };
    for (const u of list || []) { c[u.role] = (c[u.role] || 0) + 1; if (u.suspended) c.suspendu++; }
    return c;
  }, [list]);

  return (
    <>
      <div className="toolbar">
        <input id="u-search" type="search" placeholder="Rechercher un nom, un e-mail, une commune…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <div className="chips-sel" role="group" aria-label="Filtrer par rôle">
          {[["", "Tous"], ["famille", "Familles"], ["aidant", "Aidants"], ["admin", "Admins"], ["suspendu", "Suspendus"]].map(([k, l]) => (
            <button key={k} aria-pressed={role === k} onClick={() => setRole(k)}>{l} <span className="num">({counts[k] || 0})</span></button>
          ))}
        </div>
      </div>
      {error && <p className="alert">{error}</p>}
      {list === null && !error && <p className="muted" style={{ marginTop: 16 }}>Chargement…</p>}
      {list && shown.length === 0 && <p className="muted" style={{ marginTop: 16 }}>Aucun utilisateur ne correspond.</p>}
      {shown.length > 0 && <section className="panel" style={{ marginTop: 14 }}>{shown.map((u) => <Row key={u.id} u={u} me={user.id} onChange={load} />)}</section>}
    </>
  );
}
