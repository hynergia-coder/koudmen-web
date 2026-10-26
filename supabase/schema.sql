-- ============================================================
-- KOUDMEN — Schéma de base de données Supabase
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Peut être relancé sans danger (idempotent pour l'essentiel).
-- ============================================================

-- ---------- 1. Profils (un par compte) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'famille' check (role in ('famille','aidant','admin')),
  first_name  text not null default '',
  last_name   text not null default '',
  island      text check (island in ('RE','MU')),
  city        text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ---------- 2. Fiches aidants (publiques une fois vérifiées) ----------
create table if not exists public.helpers (
  id               uuid primary key references public.profiles(id) on delete cascade,
  display_name     text not null,                 -- ex. "Marie-Ange P."
  island           text not null check (island in ('RE','MU')),
  city             text not null,
  services         text[] not null default '{}',  -- garde, courses, seniors, menage, soutien, bricolage
  rate             numeric(10,2) not null check (rate > 0),
  experience_years int not null default 0 check (experience_years >= 0),
  languages        text[] not null default '{}',
  bio              text not null default '',
  available        boolean not null default true,
  status           text not null default 'pending' check (status in ('pending','verified','rejected')),
  checks           text[] not null default '{}',  -- vérifications validées par l'admin
  created_at       timestamptz not null default now()
);
create index if not exists helpers_search_idx on public.helpers (island, status);

-- ---------- 3. Demandes de mission ----------
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.profiles(id) on delete cascade,
  helper_id   uuid not null references public.helpers(id) on delete cascade,
  service     text not null,
  date        date not null,
  start_time  time,
  hours       numeric(4,1) not null default 2 check (hours > 0 and hours <= 24),
  message     text not null default '',
  status      text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','done')),
  created_at  timestamptz not null default now()
);
create index if not exists bookings_family_idx on public.bookings (family_id);
create index if not exists bookings_helper_idx on public.bookings (helper_id);

-- ---------- 4. Fonctions utilitaires ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Crée automatiquement le profil à l'inscription (rôle famille ou aidant uniquement)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, first_name, last_name)
  values (
    new.id,
    case when new.raw_user_meta_data->>'role' = 'aidant' then 'aidant' else 'famille' end,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Empêche un utilisateur de se donner le rôle admin
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- SQL Editor / service role
  if not public.is_admin() and new.role is distinct from old.role then
    if new.role = 'admin' or old.role = 'admin' then
      raise exception 'Changement de rôle non autorisé';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- Seul l'admin peut changer le statut de vérification d'un aidant
create or replace function public.guard_helper() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.checks := '{}';
    else
      new.status := old.status;
      new.checks := old.checks;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_helper on public.helpers;
create trigger guard_helper before insert or update on public.helpers
  for each row execute function public.guard_helper();

-- Transitions autorisées sur une demande
create or replace function public.guard_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  -- les champs de la demande ne changent pas après création
  if new.family_id <> old.family_id or new.helper_id <> old.helper_id or new.date <> old.date
     or new.service <> old.service or new.hours <> old.hours or new.message <> old.message then
    raise exception 'La demande ne peut plus être modifiée';
  end if;
  if auth.uid() = old.helper_id then
    if not ((old.status = 'pending' and new.status in ('accepted','declined'))
         or (old.status = 'accepted' and new.status = 'done')) then
      raise exception 'Transition non autorisée';
    end if;
  elsif auth.uid() = old.family_id then
    if not (old.status in ('pending','accepted') and new.status = 'cancelled') then
      raise exception 'Transition non autorisée';
    end if;
  else
    raise exception 'Non autorisé';
  end if;
  return new;
end $$;
drop trigger if exists guard_booking on public.bookings;
create trigger guard_booking before update on public.bookings
  for each row execute function public.guard_booking();

-- Coordonnées de l'autre partie, seulement une fois la demande acceptée
create or replace function public.booking_contact(b uuid)
returns table (first_name text, phone text)
language sql stable security definer set search_path = public as $$
  select p.first_name, p.phone
  from public.bookings bk
  join public.profiles p
    on p.id = case when auth.uid() = bk.family_id then bk.helper_id else bk.family_id end
  where bk.id = b
    and bk.status in ('accepted','done')
    and auth.uid() in (bk.family_id, bk.helper_id);
$$;

-- Nom de la famille visible par l'aidant concerné (sans téléphone)
create or replace function public.booking_family_name(b uuid)
returns text
language sql stable security definer set search_path = public as $$
  select p.first_name || ' ' || left(p.last_name, 1) || '.'
  from public.bookings bk join public.profiles p on p.id = bk.family_id
  where bk.id = b and auth.uid() in (bk.helper_id, bk.family_id);
$$;

-- ---------- 5. Règles d'accès (RLS) ----------
alter table public.profiles enable row level security;
alter table public.helpers  enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "profil: lire le sien" on public.profiles;
create policy "profil: lire le sien" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profil: modifier le sien" on public.profiles;
create policy "profil: modifier le sien" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

drop policy if exists "aidant: lire vérifiés" on public.helpers;
create policy "aidant: lire vérifiés" on public.helpers for select
  using (status = 'verified' or id = auth.uid() or public.is_admin());
drop policy if exists "aidant: créer le sien" on public.helpers;
create policy "aidant: créer le sien" on public.helpers for insert
  with check (id = auth.uid());
drop policy if exists "aidant: modifier le sien" on public.helpers;
create policy "aidant: modifier le sien" on public.helpers for update
  using (id = auth.uid() or public.is_admin());

drop policy if exists "demande: lire les siennes" on public.bookings;
create policy "demande: lire les siennes" on public.bookings for select
  using (auth.uid() in (family_id, helper_id) or public.is_admin());
drop policy if exists "demande: créer" on public.bookings;
create policy "demande: créer" on public.bookings for insert
  with check (
    family_id = auth.uid()
    and helper_id <> auth.uid()
    and exists (select 1 from public.helpers h where h.id = helper_id and h.status = 'verified')
  );
drop policy if exists "demande: mettre à jour" on public.bookings;
create policy "demande: mettre à jour" on public.bookings for update
  using (auth.uid() in (family_id, helper_id) or public.is_admin());

-- ---------- 6. Donner le rôle admin à votre compte ----------
-- Après avoir créé votre compte dans l'app, exécutez (en remplaçant l'e-mail) :
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'votre@email.com');
