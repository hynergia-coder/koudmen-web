// Reçoit les notifications de Stripe : paiement réussi, session expirée, compte aidant mis à jour.
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
const crypto = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const sig = req.headers.get("Stripe-Signature");
  const body = await req.text();
  // Deux points de réception Stripe : votre compte (paiements) et les comptes connectés (aidants)
  const secrets = [Deno.env.get("STRIPE_WEBHOOK_SECRET"), Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")].filter(Boolean) as string[];
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig!, secret, undefined, crypto);
      break;
    } catch (_) { /* essaie le secret suivant */ }
  }
  if (!event) {
    console.error("Signature Stripe invalide");
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const bookingId = s.metadata?.booking_id;
        if (!bookingId || s.payment_status !== "paid") break;
        const pi = await stripe.paymentIntents.retrieve(s.payment_intent as string);
        const { data: b } = await admin.from("bookings").select("status").eq("id", bookingId).maybeSingle();

        // Demande annulée entre-temps : remboursement immédiat
        if (b && ["cancelled", "declined"].includes(b.status)) {
          await stripe.refunds.create({ payment_intent: pi.id });
          await admin.from("bookings").update({
            payment_status: "refunded", stripe_payment_intent: pi.id, stripe_charge_id: pi.latest_charge as string,
          }).eq("id", bookingId);
          break;
        }
        await admin.from("bookings").update({
          payment_status: "paid",
          stripe_payment_intent: pi.id,
          stripe_charge_id: pi.latest_charge as string,
          paid_at: new Date().toISOString(),
        }).eq("id", bookingId);
        break;
      }
      case "checkout.session.expired": {
        const s = event.data.object as Stripe.Checkout.Session;
        const bookingId = s.metadata?.booking_id;
        if (bookingId) {
          await admin.from("bookings").update({ payment_status: "unpaid", stripe_session_id: null })
            .eq("id", bookingId).eq("payment_status", "checkout").eq("stripe_session_id", s.id);
        }
        break;
      }
      case "account.updated": {
        const a = event.data.object as Stripe.Account;
        await admin.from("helper_payouts").update({
          details_submitted: a.details_submitted,
          payouts_enabled: a.payouts_enabled,
          updated_at: new Date().toISOString(),
        }).eq("stripe_account_id", a.id);
        const helperId = a.metadata?.koudmen_helper_id;
        if (helperId) await admin.from("helpers").update({ payments_ready: Boolean(a.details_submitted && a.payouts_enabled) }).eq("id", helperId);
        break;
      }
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("Erreur de traitement", { status: 500 }); // Stripe renverra la notification
  }
});
