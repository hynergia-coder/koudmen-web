import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
// Appelle une fonction serveur et renvoie { data } ou { error: "message lisible" }
export async function callFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return { data };
  let message = "Le service de paiement ne répond pas. Réessayez dans quelques minutes.";
  try {
    const j = await error.context?.json();
    if (j?.error) message = j.error;
  } catch {}
  return { error: message };
}

export const WAITLIST_URL = import.meta.env.VITE_WAITLIST_URL || "https://form.jotform.com/262983098728071";
