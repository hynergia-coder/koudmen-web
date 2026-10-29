import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, WAITLIST_URL } from "../lib/supabase";
import { ISLANDS, SERVICES, t } from "../lib/data";
import HelperCard from "../components/HelperCard";

const readIsland = () => { try { return localStorage.getItem("kd-isle") || "RE"; } catch { return "RE"; } };

export default function Home() {
  const [island, setIsland] = useState(readIsland);
  const [service, setService] = useState("");
  const [city, setCity] = useState("");
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const isl = ISLANDS[island];

  useEffect(() => {
    try { localStorage.setItem("kd-isle", island); } catch {}
    let q = supabase.from("helpers").select("*").eq("status", "verified").eq("island", island).eq("available", true);
    if (service) q = q.contains("services", [service]);
    if (city) q = q.eq("city", city);
    setList(null);
    q.order("created_at", { ascending: false }).limit(60).then(({ data, error }) => {
      if (error) setError("Impossible de charger les aidants. Vérifiez votre connexion puis rechargez la page.");
      else { setError(""); setList(data); }
    });
  }, [island, service, city]);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">{isl.name} · aide au quotidien</p>
          <h1>{t("home_title_before")} <span>{t("home_title_highlight")}</span> {t("home_title_after")}</h1>
          <p className="lead">{t("home_lead")}</p>
          <div className="isles" role="group" aria-label="Choisir l'île">
            {Object.entries(ISLANDS).map(([k, v]) => (
              <button key={k} aria-pressed={island === k} onClick={() => { setIsland(k); setCity(""); }}>{v.name}</button>
            ))}
          </div>
          <div className="search">
            <select aria-label="Service" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">Tous les services</option>
              {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select aria-label="Commune" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Toutes les communes</option>
              {isl.cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="cats">
          {SERVICES.map((s) => (
            <button key={s.id} className="cat" aria-pressed={service === s.id} onClick={() => setService(service === s.id ? "" : s.id)}>
              <i></i><b>{s.label}</b><span>{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="wrap results">
        {error && <p className="alert">{error}</p>}
        {!error && list === null && <p className="muted">Chargement des aidants…</p>}
        {list && list.length > 0 && (
          <>
            <h2>{list.length} aidant{list.length > 1 ? "s" : ""} vérifié{list.length > 1 ? "s" : ""} · {isl.name}</h2>
            <div className="grid">{list.map((h) => <HelperCard key={h.id} h={h} />)}</div>
          </>
        )}
        {list && list.length === 0 && (
          <div className="empty">
            <h2>{t("home_empty_title")}</h2>
            <p className="muted">{t("home_empty_text")}</p>
            <div className="row-btns">
              <a className="btn gold" href={WAITLIST_URL} target="_blank" rel="noopener">Être prévenu à l'ouverture</a>
              <Link className="btn line" to="/connexion?mode=aidant">Devenir aidant·e</Link>
            </div>
          </div>
        )}
      </section>

      <section className="how">
        <div className="wrap">
          <h2>{t("how_title")}</h2>
          <div className="steps">
            {[1, 2, 3].map((n) => (
              <div className="step" key={n}><em>{n}</em><h3>{t(`how_${n}_title`)}</h3><p>{t(`how_${n}_text`)}</p></div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
