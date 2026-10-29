export const SERVICES = [
  { id: "garde", label: "Garde d'enfants", desc: "Nounous, baby-sitters, sortie d'école" },
  { id: "courses", label: "Courses & commissions", desc: "Supermarché, marché forain, pharmacie" },
  { id: "seniors", label: "Aide aux seniors", desc: "Compagnie, repas, rendez-vous médicaux" },
  { id: "menage", label: "Ménage & repassage", desc: "Entretien de la maison, linge" },
  { id: "soutien", label: "Soutien scolaire", desc: "Primaire, collège, lycée" },
  { id: "bricolage", label: "Bricolage & jardin", desc: "Petits travaux, entretien la kour" },
];

// Tous les services, actifs ou non (pour afficher le nom d'un service retiré sur une ancienne demande)
const ALL_SERVICES = [...SERVICES];
export const serviceLabel = (id) => ALL_SERVICES.find((s) => s.id === id)?.label || id;

export const ISLANDS = {
  RE: {
    name: "La Réunion",
    currency: "€",
    phone: "+262 692 00 00 00",
    cities: ["Saint-Denis", "Sainte-Marie", "Sainte-Suzanne", "Saint-André", "Bras-Panon", "Saint-Benoît", "Saint-Pierre", "Le Tampon", "Saint-Louis", "Saint-Joseph", "Saint-Paul", "Le Port", "La Possession", "Saint-Leu"],
    checks: ["Identité vérifiée", "Casier judiciaire B3", "Agrément PMI", "Diplôme vérifié", "Assurance RC"],
  },
  MU: {
    name: "Maurice",
    currency: "Rs",
    phone: "+230 5 000 0000",
    cities: ["Port Louis", "Beau Bassin-Rose Hill", "Quatre Bornes", "Vacoas-Phoenix", "Curepipe", "Moka", "Grand Baie", "Flacq", "Mahébourg", "Tamarin"],
    checks: ["Identité vérifiée", "Certificate of Character", "Références vérifiées", "Diplôme vérifié"],
  },
};

export const LANGUAGES = ["Français", "Créole réunionnais", "Créole mauricien", "Anglais", "Bhojpuri", "Hindi", "Tamoul"];

export let COMMISSION = 0.15;

// ---------- Textes modifiables depuis l'Admin ----------
// Clé -> [libellé dans l'Admin, texte par défaut]
export const TEXT_DEFS = {
  home_title_before: ["Accueil · titre (début)", "Des mains de confiance,"],
  home_title_highlight: ["Accueil · titre (mots en couleur)", "juste à côté"],
  home_title_after: ["Accueil · titre (fin)", "de chez vous."],
  home_lead: ["Accueil · sous-titre", "Chaque aidant est vérifié avant d'apparaître ici : identité, casier ou certificat de moralité, diplômes déclarés."],
  home_empty_title: ["Accueil · aucun aidant (titre)", "Pas encore d'aidant vérifié ici"],
  home_empty_text: ["Accueil · aucun aidant (texte)", "Koudmen ouvre commune par commune. Inscrivez-vous pour être prévenu, ou proposez vos services si vous êtes aidant·e."],
  how_title: ["Comment ça marche · titre", "Comment ça marche"],
  how_1_title: ["Étape 1 · titre", "Cherchez"],
  how_1_text: ["Étape 1 · texte", "Choisissez un service et votre commune. Comparez tarifs et vérifications."],
  how_2_title: ["Étape 2 · titre", "Demandez"],
  how_2_text: ["Étape 2 · texte", "Envoyez vos dates. Dès que l'aidant accepte, vous voyez ses coordonnées et pouvez l'écrire sur WhatsApp."],
  how_3_title: ["Étape 3 · titre", "Payez en sécurité"],
  how_3_text: ["Étape 3 · texte", "Payez en ligne une fois la demande acceptée. Koudmen conserve l'argent et le verse à l'aidant quand vous confirmez la fin de la mission."],
  footer_text: ["Pied de page", "KOUDMEN · Plateforme de mise en relation pour l'aide au quotidien · La Réunion et Maurice"],
};
const TEXTS = {};
export const t = (key) => (TEXTS[key] ?? TEXT_DEFS[key]?.[1] ?? "");

// Pages publiées affichées en pied de page
export const FOOTER_PAGES = [];

// ---------- Chargement du catalogue géré depuis l'Admin ----------
// Appelé une fois au démarrage : remplace les valeurs par défaut ci-dessus par celles de la base.
export async function loadCatalog(sb) {
  const [sv, ct, st, tx, pg] = await Promise.all([
    sb.from("services").select("*").order("sort").order("label"),
    sb.from("cities").select("*").eq("active", true).order("sort").order("name"),
    sb.from("settings").select("*"),
    sb.from("site_content").select("key,value"),
    sb.from("pages").select("slug,title,in_footer,sort").eq("published", true).order("sort"),
  ]);
  if (sv.data?.length) {
    const all = sv.data.map((r) => ({ id: r.id, label: r.label, desc: r.description, active: r.active }));
    ALL_SERVICES.splice(0, ALL_SERVICES.length, ...all);
    SERVICES.splice(0, SERVICES.length, ...all.filter((r) => r.active));
  }
  if (ct.data?.length) {
    for (const k of Object.keys(ISLANDS)) {
      const names = ct.data.filter((r) => r.island === k).map((r) => r.name);
      if (names.length) ISLANDS[k].cities = names;
    }
  }
  for (const r of st.data || []) {
    if (r.key === "commission" && Number(r.value) >= 0 && Number(r.value) < 1) COMMISSION = Number(r.value);
    if (r.key === "checks" && r.value) for (const k of Object.keys(ISLANDS)) if (Array.isArray(r.value[k])) ISLANDS[k].checks = r.value[k];
  }
  for (const r of tx.data || []) if (r.value?.trim()) TEXTS[r.key] = r.value;
  FOOTER_PAGES.splice(0, FOOTER_PAGES.length, ...(pg.data || []).filter((p) => p.in_footer));
}

export const money = (n, island) => {
  const v = Number(n);
  if (island === "MU") return `Rs ${Math.round(v).toLocaleString("fr-FR")}`;
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
};

export const STATUS_LABEL = {
  pending: "En attente",
  accepted: "Acceptée",
  declined: "Refusée",
  cancelled: "Annulée",
  done: "Terminée",
};

export const PAYMENT_LABEL = {
  unpaid: "Non payée",
  checkout: "Paiement en cours",
  paid: "Payée · en séquestre",
  released: "Versée à l'aidant",
  refunded: "Remboursée",
};

// Montant Stripe (centimes) -> texte
export const cents = (n, currency) =>
  currency === "mur" ? `Rs ${Math.round(n / 100).toLocaleString("fr-FR")}` : `${(n / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

export const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

// Lien WhatsApp à partir d'un numéro saisi librement
export const waLink = (phone) => {
  const digits = (phone || "").replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
};
