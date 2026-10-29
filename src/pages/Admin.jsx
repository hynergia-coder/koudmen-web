import { useSearchParams } from "react-router-dom";
import Helpers from "./admin/Helpers";
import Payments from "./admin/Payments";
import Users from "./admin/Users";
import Stats from "./admin/Stats";
import Texts from "./admin/Texts";
import Pages from "./admin/Pages";
import Catalog from "./admin/Catalog";

const TABS = [
  ["stats", "Statistiques", Stats],
  ["aidants", "Aidants", Helpers],
  ["paiements", "Paiements", Payments],
  ["utilisateurs", "Utilisateurs", Users],
  ["textes", "Textes", Texts],
  ["pages", "Pages", Pages],
  ["catalogue", "Services & réglages", Catalog],
];

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find(([k]) => k === params.get("onglet")) || TABS[0];
  const Current = tab[2];

  return (
    <div className="wrap page">
      <h1>Administration</h1>
      <div className="subtabs admin-tabs" role="group" aria-label="Rubriques d'administration">
        {TABS.map(([k, l]) => (
          <button key={k} aria-pressed={tab[0] === k} onClick={() => setParams({ onglet: k })}>{l}</button>
        ))}
      </div>
      <div className="admin-body"><Current /></div>
    </div>
  );
}
