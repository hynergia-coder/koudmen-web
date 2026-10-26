// Ouvre une page de paiement Stripe pour une demande acceptée. L'argent reste sur le compte Koudmen (séquestre).
// Fichier autonome : peut être collé tel quel dans l'éditeur de fonctions Supabase.

import Stripe from "npm:stripe@16.12.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export const COMMISSION = 0.15; // part Koudmen

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const fail = (message: string, status = 400) => json({ error: message }, status);

// Client avec tous les droits (clé service) : écritures de paiement
export const admin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Utilisateur qui appelle la fonction (à partir de son jeton de connexion)
export async function callerOf(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin.from("profiles").select("id, role, first_name, last_name").eq("id", data.user.id).maybeSingle();
  return profile ? { ...profile, email: data.user.email ?? undefined } : null;
}

export const siteUrl = () => (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

// Île -> devise et pays du compte Stripe de l'aidant
export const ISLAND = {
  RE: { currency: "eur", country: "FR" },
  MU: { currency: "mur", country: "MU" },
} as const;

// ---------- Fonction ----------
const SERVICE_LABEL: Record<string, string> = {
  garde: "Garde d'enfants", courses: "Courses & commissions", seniors: "Aide aux seniors",
  menage: "Ménage & repassage", soutien: "Soutien scolaire", bricolage: "Bricolage & jardin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const me = await callerOf(req);
    if (!me) return fail("Connectez-vous pour payer.", 401);
    const { booking_id } = await req.json();

    const { data: b } = await admin.from("bookings")
      .select("*, helpers(display_name, island, rate)")
      .eq("id", booking_id).maybeSingle();
    if (!b || b.family_id !== me.id) return fail("Demande introuvable.", 404);
    if (b.status !== "accepted") return fail("Le paiement est possible une fois la demande acceptée.");
    if (b.payment_status === "paid" || b.payment_status === "released") return fail("Cette mission est déjà payée.");

    const { data: payout } = await admin.from("helper_payouts").select("details_submitted").eq("id", b.helper_id).maybeSingle();
    if (!payout?.details_submitted) {
      return fail("L'aidant n'a pas encore activé son compte de versement. Il a été invité à le faire ; réessayez plus tard.");
    }

    const island = b.helpers.island as "RE" | "MU";
    const currency = ISLAND[island].currency;
    const amount = Math.round(Number(b.helpers.rate) * Number(b.hours) * 100); // EUR et MUR : 2 décimales chez Stripe
    if (amount < 100) return fail("Montant trop faible pour un paiement en ligne.");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      customer_email: me.email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amount,
          product_data: {
            name: `${SERVICE_LABEL[b.service] ?? b.service} avec ${b.helpers.display_name}`,
            description: `${b.date} · ${b.hours} h · paiement conservé par Koudmen jusqu'à la fin de la mission`,
          },
        },
      }],
      payment_intent_data: {
        transfer_group: b.id,
        description: `Koudmen mission ${b.id}`,
        metadata: { booking_id: b.id },
      },
      metadata: { booking_id: b.id },
      success_url: `${siteUrl()}/tableau-de-bord?paiement=ok`,
      cancel_url: `${siteUrl()}/tableau-de-bord?paiement=annule`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 h
    });

    await admin.from("bookings").update({
      payment_status: "checkout", stripe_session_id: session.id, amount_cents: amount, currency,
    }).eq("id", b.id);

    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return fail("Le paiement n'a pas pu être préparé. Réessayez dans quelques minutes.", 500);
  }
});
