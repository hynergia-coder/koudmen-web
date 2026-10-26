export const SERVICES = [
  { id: "garde", label: "Garde d'enfants", desc: "Nounous, baby-sitters, sortie d'école" },
  { id: "courses", label: "Courses & commissions", desc: "Supermarché, marché forain, pharmacie" },
  { id: "seniors", label: "Aide aux seniors", desc: "Compagnie, repas, rendez-vous médicaux" },
  { id: "menage", label: "Ménage & repassage", desc: "Entretien de la maison, linge" },
  { id: "soutien", label: "Soutien scolaire", desc: "Primaire, collège, lycée" },
  { id: "bricolage", label: "Bricolage & jardin", desc: "Petits travaux, entretien la kour" },
];

export const serviceLabel = (id) => SERVICES.find((s) => s.id === id)?.label || id;

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

export const COMMISSION = 0.15;

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
