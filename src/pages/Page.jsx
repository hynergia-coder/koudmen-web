import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import RichText from "../components/RichText";

// Page de contenu (CGU, mentions légales, FAQ…) créée depuis l'Admin
export default function Page() {
  const { slug } = useParams();
  const [page, setPage] = useState(undefined);

  useEffect(() => {
    setPage(undefined);
    supabase.from("pages").select("*").eq("slug", slug).maybeSingle().then(({ data }) => {
      setPage(data || null);
      if (data) document.title = `${data.title} · Koudmen`;
    });
  }, [slug]);

  if (page === undefined) return <div className="wrap page narrow"><p className="muted">Chargement…</p></div>;
  if (page === null) return (
    <div className="wrap page narrow">
      <h1>Page introuvable</h1>
      <p className="muted" style={{ marginTop: 8 }}>Cette page n'existe pas ou n'est pas encore publiée.</p>
      <Link className="btn" style={{ marginTop: 16 }} to="/">Retour à l'accueil</Link>
    </div>
  );

  return (
    <div className="wrap page narrow">
      {!page.published && <p className="hint gold-hint" style={{ marginBottom: 16 }}>Brouillon : visible uniquement par les administrateurs.</p>}
      <h1>{page.title}</h1>
      <div className="panel" style={{ marginTop: 18 }}><RichText text={page.body} /></div>
      <p className="muted small" style={{ marginTop: 12 }}>Dernière mise à jour : {new Date(page.updated_at).toLocaleDateString("fr-FR")}</p>
    </div>
  );
}
