import { Link } from "react-router-dom";
import { initials, money, serviceLabel } from "../lib/data";

export default function HelperCard({ h }) {
  return (
    <article className="card">
      <div className="who">
        <div className="av" aria-hidden="true">{initials(h.display_name)}</div>
        <div>
          <b>{h.display_name}</b>
          <div className="meta">{h.city} · {h.experience_years} an{h.experience_years > 1 ? "s" : ""} d'expérience</div>
          <div className="meta">{h.services.map(serviceLabel).join(" · ")}</div>
        </div>
      </div>
      <p className="bio clamp">{h.bio}</p>
      <div className="badges">
        {h.checks.slice(0, 3).map((c) => <span className="badge" key={c}>✓ {c}</span>)}
        {h.checks.length > 3 && <span className="badge g">+{h.checks.length - 3}</span>}
      </div>
      <div className="card-foot">
        <span className="rate">{money(h.rate, h.island)}<small> /h</small></span>
        <Link className="btn" to={`/aidant/${h.id}`}>Voir le profil</Link>
      </div>
    </article>
  );
}
