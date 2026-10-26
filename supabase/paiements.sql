-- ============================================================
-- KOUDMEN — Paiement en ligne (Stripe Connect, séquestre)
-- À exécuter APRÈS schema.sql, dans Supabase > SQL Editor.
-- Peut être relancé sans danger.
-- ============================================================

-- ---------- 1. Suivi du paiement sur chaque demande ----------
alter table public.bookings
  add column if not exists amount_cents          integer,
  add column if not exists currency              text check (currency in ('eur','mur')),
  add column if not exists payment_status        text not null default 'unpaid'
    check (payment_status in ('unpaid','checkout','paid','released','refunded')),
  add column if not exists stripe_session_id     text,
  add column if not exists stripe_payment_intent text,
  add column if not exists stripe_charge_id      text,
  add column if not exists stripe_transfer_id    text,
  add column if not exists helper_payout_cents   integer,
  add column if not exists payout_currency       text,
  add column if not exists paid_at               timestamptz,
  add column if not exists released_at           timestamptz;

-- ---------- 2. Compte de versement Stripe de chaque aidant (privé) ----------
create table if not exists public.helper_payouts (
  id                 uuid primary key references public.helpers(id) on delete cascade,
  stripe_account_id  text not null unique,
  country            text not null,
  details_submitted  boolean not null default false,
  payouts_enabled    boolean not null default false,
  updated_at         timestamptz not null default now()
);
alter table public.helper_payouts enable row level security;

drop policy if exists "versement: lire le sien" on public.helper_payouts;
create policy "versement: lire le sien" on public.helper_payouts for select
  using (id = auth.uid() or public.is_admin());
-- Aucune écriture depuis l'app : seules les fonctions serveur (clé service) écrivent ici.

-- ---------- 3. Règles de transition mises à jour ----------
create or replace function public.guard_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Fonctions serveur (clé service) et SQL Editor : tout est permis
  if auth.uid() is null then return new; end if;
  if public.is_admin() then return new; end if;

  -- Champs de la demande et du paiement non modifiables depuis l'app
  if new.family_id <> old.family_id or new.helper_id <> old.helper_id or new.date <> old.date
     or new.service <> old.service or new.hours <> old.hours or new.message <> old.message
     or new.payment_status is distinct from old.payment_status
     or new.amount_cents is distinct from old.amount_cents
     or new.currency is distinct from old.currency
     or new.stripe_session_id is distinct from old.stripe_session_id
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent
     or new.stripe_charge_id is distinct from old.stripe_charge_id
     or new.stripe_transfer_id is distinct from old.stripe_transfer_id
     or new.helper_payout_cents is distinct from old.helper_payout_cents
     or new.paid_at is distinct from old.paid_at
     or new.released_at is distinct from old.released_at then
    raise exception 'La demande ne peut pas être modifiée ainsi';
  end if;

  if auth.uid() = old.helper_id then
    if old.status = 'pending' and new.status in ('accepted','declined') then
      return new;
    elsif old.status = 'accepted' and new.status = 'done' then
      if old.payment_status <> 'paid' then
        raise exception 'La mission doit être payée avant d''être marquée terminée';
      end if;
      return new;
    end if;
    raise exception 'Transition non autorisée';
  elsif auth.uid() = old.family_id then
    if old.status in ('pending','accepted') and new.status = 'cancelled' then
      if old.payment_status = 'paid' then
        raise exception 'Demande déjà payée : utilisez « Annuler et être remboursé »';
      end if;
      return new;
    end if;
    raise exception 'Transition non autorisée';
  end if;
  raise exception 'Non autorisé';
end $$;

-- ---------- 4. L'admin voit aussi le nom de la famille (suivi des paiements) ----------
create or replace function public.booking_family_name(b uuid)
returns text
language sql stable security definer set search_path = public as $$
  select p.first_name || ' ' || left(p.last_name, 1) || '.'
  from public.bookings bk join public.profiles p on p.id = bk.family_id
  where bk.id = b and (auth.uid() in (bk.helper_id, bk.family_id) or public.is_admin());
$$;

-- ---------- 5. Indicateur public « paiement en ligne prêt » sur la fiche aidant ----------
alter table public.helpers add column if not exists payments_ready boolean not null default false;

create or replace function public.guard_helper() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.checks := '{}';
      new.payments_ready := false;
    else
      new.status := old.status;
      new.checks := old.checks;
      new.payments_ready := old.payments_ready;
    end if;
  end if;
  return new;
end $$;

-- On ne peut demander une mission qu'à un aidant vérifié dont le paiement en ligne est prêt
drop policy if exists "demande: créer" on public.bookings;
create policy "demande: créer" on public.bookings for insert
  with check (
    family_id = auth.uid()
    and helper_id <> auth.uid()
    and exists (select 1 from public.helpers h where h.id = helper_id and h.status = 'verified' and h.payments_ready)
  );

-- ---------- 6. Durcissement : fonctions internes non appelables via l'API ----------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile() from public, anon, authenticated;
revoke execute on function public.guard_helper() from public, anon, authenticated;
revoke execute on function public.guard_booking() from public, anon, authenticated;
revoke execute on function public.booking_contact(uuid) from public, anon;
revoke execute on function public.booking_family_name(uuid) from public, anon;
grant execute on function public.booking_contact(uuid) to authenticated;
grant execute on function public.booking_family_name(uuid) to authenticated;
