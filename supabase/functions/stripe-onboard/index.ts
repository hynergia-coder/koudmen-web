// Crée (ou reprend) le compte de versement Stripe de l'aidant et renvoie le lien d'inscription Stripe.
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const me = await callerOf(req);
    if (!me) return fail("Connectez-vous pour continuer.", 401);

    const { data: helper } = await admin.from("helpers").select("id, island").eq("id", me.id).maybeSingle();
    if (!helper) return fail("Créez d'abord votre fiche aidant.");

    let { data: payout } = await admin.from("helper_payouts").select("*").eq("id", me.id).maybeSingle();

    if (!payout) {
      const conf = ISLAND[helper.island as "RE" | "MU"];
      // Réunion : compte français complet. Maurice : compte « destinataire » (versements transfrontaliers).
      const account = await stripe.accounts.create({
        type: "express",
        country: conf.country,
        email: me.email,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        ...(conf.country === "MU" ? { tos_acceptance: { service_agreement: "recipient" } } : {}),
        business_profile: { product_description: "Services à la personne via Koudmen", mcc: "7299" },
        metadata: { koudmen_helper_id: me.id },
      });
      const { data, error } = await admin.from("helper_payouts")
        .insert({ id: me.id, stripe_account_id: account.id, country: conf.country })
        .select().single();
      if (error) return fail("Impossible d'enregistrer le compte de versement.", 500);
      payout = data;
    }

    const link = await stripe.accountLinks.create({
      account: payout.stripe_account_id,
      type: "account_onboarding",
      refresh_url: `${siteUrl()}/devenir-aidant?versement=reprendre`,
      return_url: `${siteUrl()}/devenir-aidant?versement=retour`,
    });
    return json({ url: link.url });
  } catch (e) {
    console.error(e);
    return fail("Stripe n'a pas pu ouvrir l'inscription. Réessayez dans quelques minutes.", 500);
  }
});
