import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ISLANDS } from "../../lib/data";

const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function Services() {
  const [list, setList] = useState(null);
  const [dirty, setDirty] = useState({});
  const [add, setAdd] = useState({ label: "", description: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = useCallback(() => supabase.from("services").select("*").order("sort").then(({ data }) => { setList(data || []); setDirty({}); }), []);
  useEffect(() => { load(); }, [load]);

  const edit = (id, k, v) => {
    setList(list.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
    setDirty({ ...dirty, [id]: true });
  };
  const save = async () => {
    const rows = list.filter((s) => dirty[s.id]).map((s) => ({ id: s.id, label: s.label.trim(), description: s.description.trim(), sort: Number(s.sort) || 0, active: s.active }));
    const { error } = await supabase.from("services").upsert(rows);
    setMsg(error ? { type: "alert", text: "Enregistrement impossible." } : { type: "hint", text: "Services enregistrés." });
    if (!error) load();
  };
  const create = async (e) => {
    e.preventDefault();
    const id = slugify(add.label);
    if (!id) return;
    const { error } = await supabase.from("services").insert({ id, label: add.label.trim(), description: add.description.trim(), sort: (list?.length || 0) + 1 });
    setMsg(error ? { type: "alert", text: error.code === "23505" ? "Ce service existe déjà." : "Ajout impossible." } : { type: "hint", text: "Service ajouté." });
    if (!error) { setAdd({ label: "", description: "" }); load(); }
  };

  if (!list) return <p className="muted">Chargement…</p>;
  return (
    <section className="panel">
      <h2>Services proposés</h2>
      <p className="muted small">Un service désactivé n'apparaît plus dans la recherche ni dans les fiches, mais les demandes passées restent lisibles.</p>
      <div className="cat-table">
        {list.map((s) => (
          <div className={"cat-row" + (s.active ? "" : " off")} key={s.id}>
            <input aria-label="Ordre" className="ord" type="number" value={s.sort} onChange={(e) => edit(s.id, "sort", e.target.value)} />
            <input aria-label="Nom du service" value={s.label} onChange={(e) => edit(s.id, "label", e.target.value)} />
            <input aria-label="Description" value={s.description} onChange={(e) => edit(s.id, "description", e.target.value)} />
            <label className="check"><input type="checkbox" checked={s.active} onChange={(e) => edit(s.id, "active", e.target.checked)} /> Actif</label>
          </div>
        ))}
      </div>
      {msg.text && <p className={msg.type}>{msg.text}</p>}
      <button className="btn" style={{ marginTop: 12 }} disabled={!Object.keys(dirty).length} onClick={save}>Enregistrer les services</button>
      <form className="add-row" onSubmit={create}>
        <input placeholder="Nouveau service (ex. Garde d'animaux)" value={add.label} onChange={(e) => setAdd({ ...add, label: e.target.value })} aria-label="Nom du nouveau service" />
        <input placeholder="Description courte" value={add.description} onChange={(e) => setAdd({ ...add, description: e.target.value })} aria-label="Description du nouveau service" />
        <button className="btn line" disabled={!add.label.trim()}>Ajouter</button>
      </form>
    </section>
  );
}

function Cities() {
  const [island, setIsland] = useState("RE");
  const [list, setList] = useState(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(() => supabase.from("cities").select("*").eq("island", island).order("sort").order("name").then(({ data }) => setList(data || [])), [island]);
  useEffect(() => { setList(null); load(); }, [load]);

  const toggle = async (c) => { await supabase.from("cities").update({ active: !c.active }).eq("id", c.id); load(); };
  const create = async (e) => {
    e.preventDefault(); setErr("");
    const { error } = await supabase.from("cities").insert({ island, name: name.trim(), sort: (list?.length || 0) + 1 });
    if (error) setErr(error.code === "23505" ? "Cette commune existe déjà." : "Ajout impossible.");
    else { setName(""); load(); }
  };

  return (
    <section className="panel">
      <h2>Communes</h2>
      <div className="chips-sel" role="group" aria-label="Île">
        {Object.entries(ISLANDS).map(([k, v]) => <button key={k} aria-pressed={island === k} onClick={() => setIsland(k)}>{v.name}</button>)}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Cliquez sur une commune pour l'activer ou la masquer dans les listes.</p>
      {!list ? <p className="muted">Chargement…</p> : (
        <div className="chips-sel" style={{ marginTop: 10 }}>
          {list.map((c) => <button key={c.id} aria-pressed={c.active} onClick={() => toggle(c)} title={c.active ? "Masquer" : "Activer"}>{c.name}</button>)}
        </div>
      )}
      <form className="add-row" onSubmit={create}>
        <input placeholder="Ajouter une commune" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nouvelle commune" />
        <button className="btn line" disabled={!name.trim()}>Ajouter</button>
      </form>
      {err && <p className="alert">{err}</p>}
    </section>
  );
}

function Settings() {
  const [pct, setPct] = useState("");
  const [checks, setChecks] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    supabase.from("settings").select("*").then(({ data }) => {
      const m = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
      setPct(String(Math.round(Number(m.commission ?? 0.15) * 1000) / 10));
      const c = m.checks || {};
      setChecks({ RE: (c.RE || ISLANDS.RE.checks).join("\n"), MU: (c.MU || ISLANDS.MU.checks).join("\n") });
    });
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const v = Number(String(pct).replace(",", "."));
    if (!(v >= 0 && v < 50)) return setMsg({ type: "alert", text: "La commission doit être comprise entre 0 et 50 %." });
    const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    const { error } = await supabase.from("settings").upsert([
      { key: "commission", value: Math.round(v * 10) / 1000 },
      { key: "checks", value: { RE: lines(checks.RE), MU: lines(checks.MU) } },
    ]);
    setMsg(error ? { type: "alert", text: "Enregistrement impossible." } : { type: "hint", text: "Réglages enregistrés. La nouvelle commission s'applique aux prochains versements." });
  };

  if (!checks) return <p className="muted">Chargement…</p>;
  return (
    <form className="panel form" onSubmit={save}>
      <h2>Réglages</h2>
      <label htmlFor="st-com">Commission Koudmen (%)</label>
      <input id="st-com" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} style={{ maxWidth: 140 }} />
      <p className="muted small">Prélevée sur chaque mission au moment du versement à l'aidant. Pensez à mettre à jour les conditions générales si vous la modifiez.</p>
      <div className="two">
        <div>
          <label htmlFor="st-re">Vérifications · La Réunion (une par ligne)</label>
          <textarea id="st-re" rows="6" value={checks.RE} onChange={(e) => setChecks({ ...checks, RE: e.target.value })} />
        </div>
        <div>
          <label htmlFor="st-mu">Vérifications · Maurice (une par ligne)</label>
          <textarea id="st-mu" rows="6" value={checks.MU} onChange={(e) => setChecks({ ...checks, MU: e.target.value })} />
        </div>
      </div>
      <p className="muted small">La première vérification de chaque liste est obligatoire pour valider une fiche aidant.</p>
      {msg.text && <p className={msg.type}>{msg.text}</p>}
      <button className="btn wide">Enregistrer les réglages</button>
    </form>
  );
}

export default function Catalog() {
  return (
    <div className="stack">
      <Services />
      <Cities />
      <Settings />
      <p className="muted small">Les changements apparaissent sur le site au prochain chargement de la page.</p>
    </div>
  );
}
