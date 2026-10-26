// Fin du séquestre :
//  - "release" : la famille confirme la mission terminée (ou l'admin tranche) -> versement à l'aidant, moins la commission
//  - "refund"  : la famille annule une mission payée avant qu'elle ait lieu (ou l'admin tranche) -> remboursement intégral
//  - "sync"    : l'aidant revient de l'inscription Stripe -> mise à jour de son statut de versement
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
    const { action, booking_id } = await req.json();
    const isAdmin = me.role === "admin";

    if (action === "sync") {
      const { data: p } = await admin.from("helper_payouts").select("stripe_account_id").eq("id", me.id).maybeSingle();
      if (!p) return json({ details_submitted: false, payouts_enabled: false });
      const a = await stripe.accounts.retrieve(p.stripe_account_id);
      const row = { details_submitted: a.details_submitted, payouts_enabled: a.payouts_enabled, updated_at: new Date().toISOString() };
      await admin.from("helper_payouts").update(row).eq("id", me.id);
      await admin.from("helpers").update({ payments_ready: Boolean(a.details_submitted && a.payouts_enabled) }).eq("id", me.id);
      return json(row);
    }

    const { data: b } = await admin.from("bookings").select("*").eq("id", booking_id).maybeSingle();
    if (!b) return fail("Demande introuvable.", 404);
    const isFamily = b.family_id === me.id;

    if (action === "release") {
      if (!(isFamily || isAdmin)) return fail("Seule la famille peut confirmer la mission.", 403);
      if (b.status !== "done" && !(isAdmin && b.status === "accepted")) return fail("L'aidant doit d'abord marquer la mission comme terminée.");
      if (b.payment_status !== "paid") return fail("Aucun paiement à verser pour cette mission.");

      const { data: p } = await admin.from("helper_payouts").select("stripe_account_id").eq("id", b.helper_id).maybeSingle();
      if (!p) return fail("Compte de versement de l'aidant introuvable. Contactez Koudmen.", 409);

      // Le versement se fait dans la devise du solde Koudmen (EUR), calculée sur le montant réellement encaissé.
      const charge = await stripe.charges.retrieve(b.stripe_charge_id, { expand: ["balance_transaction"] });
      const bt = charge.balance_transaction as { amount: number; currency: string };
      const payoutCents = Math.floor(bt.amount * (1 - COMMISSION));

      const transfer = await stripe.transfers.create({
        amount: payoutCents,
        currency: bt.currency,
        destination: p.stripe_account_id,
        source_transaction: b.stripe_charge_id,
        transfer_group: b.id,
        metadata: { booking_id: b.id },
      }, { idempotencyKey: `release-${b.id}` });

      await admin.from("bookings").update({
        status: "done", payment_status: "released", stripe_transfer_id: transfer.id,
        helper_payout_cents: payoutCents, payout_currency: bt.currency, released_at: new Date().toISOString(),
      }).eq("id", b.id);
      return json({ ok: true });
    }

    if (action === "refund") {
      if (!(isFamily || isAdmin)) return fail("Non autorisé.", 403);
      if (b.payment_status !== "paid") return fail("Aucun paiement à rembourser.");
      if (!isAdmin && !["pending", "accepted"].includes(b.status)) return fail("La mission a eu lieu : contactez Koudmen pour un litige.");

      await stripe.refunds.create({ payment_intent: b.stripe_payment_intent }, { idempotencyKey: `refund-${b.id}` });
      await admin.from("bookings").update({ status: "cancelled", payment_status: "refunded" }).eq("id", b.id);
      return json({ ok: true });
    }

    return fail("Action inconnue.");
  } catch (e) {
    console.error(e);
    return fail("L'opération n'a pas abouti. Réessayez, ou contactez Koudmen si le problème continue.", 500);
  }
});
