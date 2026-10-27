import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import emblem from "../assets/emblem.png";

export default function Layout() {
  const { user, profile, signOut, recovery } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  // Lien « mot de passe oublié » : on emmène directement vers le choix du nouveau mot de passe
  useEffect(() => {
    if (recovery && user && pathname !== "/mon-profil") nav("/mon-profil", { replace: true });
  }, [recovery, user, pathname, nav]);
  const out = async () => { await signOut(); nav("/"); };

  return (
    <>
      <header className="bar">
        <div className="wrap bar-in">
          <Link to="/" className="brand">
            <span className="emblem"><img src={emblem} alt="" /></span>
            <span className="word">KOUDMEN<small>Aide au quotidien</small></span>
          </Link>
          <nav className="nav">
            {user ? (
              <>
                <NavLink to="/tableau-de-bord">Tableau de bord</NavLink>
                {profile?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
                <NavLink to="/mon-profil">Mon profil</NavLink>
                <button className="link" onClick={out}>Déconnexion</button>
              </>
            ) : (
              <>
                <NavLink to="/connexion?mode=aidant">Devenir aidant·e</NavLink>
                <Link className="btn" to="/connexion">Se connecter</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="foot-site">
        <div className="wrap">
          KOUDMEN · Plateforme de mise en relation pour l'aide au quotidien · La Réunion et Maurice
        </div>
      </footer>
    </>
  );
}
