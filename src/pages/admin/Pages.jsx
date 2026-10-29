import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import RichText from "../../components/RichText";

const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function Editor({ page, isNew, onClose }) {
  const [f, setF] = useState({ ...page });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const set = (k, v) => setF({ ...f, [k]: v });
  const placeholders = (f.body.match(/\[[A-ZÀ-Ü0-9 ]{3,}\]/g) || []);

  const save = async () => {
    if (!f.title.trim()) return setMsg({ type: "alert", text: "Donnez un titre à la page." });
    const slug = isNew ? slugify(f.slug || f.title) : f.slug;
    if (!slug) return setMsg({ type: "alert", text: "L'adresse de la page est invalide." });
    setBusy(true); setMsg({ type: "", text: "" });
    const row = { slug, title: f.title.trim(), body: f.body, published: f.published, in_footer: f.in_footer, sort: Number(f.sort) || 0, updated_at: new Date().toISOString() };
    const { error } = isNew ? await supabase.from("pages").insert(row) : await supabase.from("pages").update(row).eq("slug", slug);
    setBusy(false);
    if (error) return setMsg({ type: "alert", text: error.code === "23505" ? "Une page existe déjà à cette adresse." : "Enregistrement impossible." });
    onClose(true);
  };
  const remove = async () => {
    setBusy(true);
    await supabase.from("pages").delete().eq("slug", f.slug);
    setBusy(false); onClose(true);
  };

  return (
    <div className="panel form">
      <div className="req-top" style={{ justifyContent: "space-between" }}>
        <h2 style={{ marginBottom: 0 }}>{isNew ? "Nouvelle page" : f.title}</h2>
        <button type="button" className="link" onClick={() => onClose(false)}>← Retour à la liste</button>
      </div>
      <label htmlFor="pg-title">Titre</label>
      <input id="pg-title" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <label htmlFor="pg-slug">Adresse de la page</label>
      <div className="slug-row">
        <span className="muted small">koudmen.re/page/</span>
        <input id="pg-slug" value={isNew ? (f.slug || slugify(f.title)) : f.slug} disabled={!isNew} onChange={(e) => set("slug", slugify(e.target.value))} />
      </div>
      <div className="req-top" style={{ justifyContent: "space-between", marginTop: 14 }}>
        <span className="label" style={{ margin: 0 }}>Contenu</span>
        <button type="button" className="link small" onClick={() => setPreview(!preview)}>{preview ? "Modifier le texte" : "Aperçu"}</button>
      </div>
      {preview
        ? <div className="preview"><RichText text={f.body} /></div>
        : <textarea id="pg-body" rows="16" value={f.body} onChange={(e) => set("body", e.target.value)} />}
      <p className="muted small">Mise en forme : « # Titre », « ## Sous-titre », « - élément de liste », « **texte en gras** », ligne vide pour un nouveau paragraphe.</p>
      {placeholders.length > 0 && <p className="hint gold-hint">À compléter avant publication : {[...new Set(placeholders)].join(", ")}</p>}
      <label className="check"><input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} /> Publiée (visible par tous)</label>
      <label className="check"><input type="checkbox" checked={f.in_footer} onChange={(e) => set("in_footer", e.target.checked)} /> Lien dans le pied de page</label>
      <label htmlFor="pg-sort">Ordre dans le pied de page</label>
      <input id="pg-sort" type="number" value={f.sort} onChange={(e) => set("sort", e.target.value)} style={{ maxWidth: 120 }} />
      {msg.text && <p className={msg.type}>{msg.text}</p>}
      <button className="btn wide" disabled={busy} onClick={save}>{busy ? "Enregistrement…" : "Enregistrer la page"}</button>
      {!isNew && (confirmDel
        ? <div className="confirm" style={{ marginTop: 12 }}>
            <p className="small">Supprimer définitivement la page « {f.title} » ?</p>
            <div className="act"><button className="btn sm" disabled={busy} onClick={remove}>Oui, supprimer</button><button className="btn sm line" onClick={() => setConfirmDel(false)}>Annuler</button></div>
          </div>
        : <button type="button" className="link center" style={{ marginTop: 12 }} onClick={() => setConfirmDel(true)}>Supprimer la page</button>)}
    </div>
  );
}

export default function Pages() {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // { page, isNew }

  const load = useCallback(() => {
    supabase.from("pages").select("*").order("sort").then(({ data }) => setList(data || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (editing) return <Editor {...editing} onClose={(changed) => { setEditing(null); if (changed) load(); }} />;

  return (
    <>
      <div className="req-top" style={{ justifyContent: "space-between" }}>
        <p className="muted">Pages d'information : CGU, mentions légales, FAQ, contact… Les liens publiés apparaissent dans le pied de page.</p>
        <button className="btn sm" onClick={() => setEditing({ isNew: true, page: { slug: "", title: "", body: "", published: false, in_footer: true, sort: (list?.length || 0) + 1 } })}>Nouvelle page</button>
      </div>
      {list === null && <p className="muted" style={{ marginTop: 16 }}>Chargement…</p>}
      {list?.length > 0 && (
        <section className="panel" style={{ marginTop: 14 }}>
          {list.map((p) => (
            <div className="user-row" key={p.slug}>
              <div className="txt">
                <div className="req-top">
                  <b>{p.title}</b>
                  <span className={"pill " + (p.published ? "accepted" : "pending")}>{p.published ? "Publiée" : "Brouillon"}</span>
                  {/\[[A-ZÀ-Ü0-9 ]{3,}\]/.test(p.body) && <span className="pill pay-checkout">À compléter</span>}
                </div>
                <div className="meta">/page/{p.slug} · modifiée le {new Date(p.updated_at).toLocaleDateString("fr-FR")}</div>
              </div>
              <div className="act">
                <Link className="btn sm line" to={`/page/${p.slug}`}>Voir</Link>
                <button className="btn sm" onClick={() => setEditing({ isNew: false, page: p })}>Modifier</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
