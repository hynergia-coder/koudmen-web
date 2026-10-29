import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { TEXT_DEFS } from "../../lib/data";

export default function Texts() {
  const [values, setValues] = useState(null);
  const [saved, setSaved] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    supabase.from("site_content").select("key,value").then(({ data }) => {
      const v = {};
      for (const k of Object.keys(TEXT_DEFS)) v[k] = TEXT_DEFS[k][1];
      for (const r of data || []) if (r.value?.trim()) v[r.key] = r.value;
      setValues(v); setSaved(v);
    });
  }, []);

  if (!values) return <p className="muted">Chargement…</p>;
  const changed = Object.keys(values).filter((k) => values[k] !== saved[k]);

  const save = async () => {
    setBusy(true); setMsg({ type: "", text: "" });
    const rows = changed.map((key) => ({ key, value: values[key].trim(), updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("site_content").upsert(rows);
    setBusy(false);
    if (error) return setMsg({ type: "alert", text: "Enregistrement impossible. Réessayez." });
    setSaved({ ...values });
    setMsg({ type: "hint", text: "Textes enregistrés. Ils apparaissent sur le site au prochain chargement de la page." });
  };
  const reset = (k) => setValues({ ...values, [k]: TEXT_DEFS[k][1] });

  return (
    <>
      <p className="muted">Modifiez les textes affichés sur le site. Un champ vidé reprend le texte d'origine.</p>
      <div className="panel form" style={{ marginTop: 14 }}>
        {Object.entries(TEXT_DEFS).map(([k, [lbl, def]]) => (
          <div key={k}>
            <label htmlFor={`tx-${k}`}>{lbl}</label>
            <textarea id={`tx-${k}`} rows={values[k].length > 90 ? 3 : 1} value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
            {values[k] !== def && <button type="button" className="link small" onClick={() => reset(k)}>Revenir au texte d'origine</button>}
          </div>
        ))}
        {msg.text && <p className={msg.type}>{msg.text}</p>}
        <button className="btn wide" disabled={busy || changed.length === 0} onClick={save}>
          {busy ? "Enregistrement…" : changed.length ? `Enregistrer ${changed.length} modification${changed.length > 1 ? "s" : ""}` : "Aucune modification"}
        </button>
      </div>
    </>
  );
}
