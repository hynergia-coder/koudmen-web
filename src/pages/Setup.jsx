export default function Setup() {
  return (
    <div className="wrap page" style={{ maxWidth: 640 }}>
      <h1>Configuration requise</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        L'app ne trouve pas la connexion à Supabase. Ajoutez les variables
        <code> VITE_SUPABASE_URL </code> et <code> VITE_SUPABASE_ANON_KEY </code>
        (fichier <code>.env</code> en local, ou variables d'environnement de Cloudflare Pages), puis relancez le build.
        Le guide <code>README.md</code> détaille chaque étape.
      </p>
    </div>
  );
}
