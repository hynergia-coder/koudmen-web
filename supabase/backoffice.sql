-- ============================================================
-- KOUDMEN — Back-office : contenus, catalogue, utilisateurs, statistiques
-- À exécuter APRÈS schema.sql et paiements.sql. Peut être relancé sans danger.
-- ============================================================

-- ---------- 1. Tables de contenu ----------
create table if not exists public.site_content (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  slug       text primary key check (slug ~ '^[a-z0-9-]+$'),
  title      text not null,
  body       text not null default '',
  published  boolean not null default false,
  in_footer  boolean not null default true,
  sort       int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  label       text not null,
  description text not null default '',
  sort        int not null default 0,
  active      boolean not null default true
);

create table if not exists public.cities (
  id     bigint generated always as identity primary key,
  island text not null check (island in ('RE','MU')),
  name   text not null,
  sort   int not null default 0,
  active boolean not null default true,
  unique (island, name)
);

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);

-- ---------- 2. Suspension de comptes ----------
alter table public.profiles add column if not exists suspended boolean not null default false;

create or replace function public.is_suspended(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = uid), false);
$$;

-- Un utilisateur ne peut ni changer de rôle vers/depuis admin, ni lever sa propre suspension
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.suspended is distinct from old.suspended then
    raise exception 'Modification non autorisée';
  end if;
  if new.role is distinct from old.role and (new.role = 'admin' or old.role = 'admin') then
    raise exception 'Changement de rôle non autorisé';
  end if;
  return new;
end $$;

-- Aidants suspendus invisibles ; comptes suspendus ne peuvent pas créer de demande
drop policy if exists "aidant: lire vérifiés" on public.helpers;
create policy "aidant: lire vérifiés" on public.helpers for select
  using ((status = 'verified' and not public.is_suspended(id)) or id = auth.uid() or public.is_admin());

drop policy if exists "demande: créer" on public.bookings;
create policy "demande: créer" on public.bookings for insert
  with check (
    family_id = auth.uid()
    and helper_id <> auth.uid()
    and not public.is_suspended(auth.uid())
    and exists (select 1 from public.helpers h where h.id = helper_id and h.status = 'verified' and h.payments_ready)
  );

-- ---------- 3. Règles d'accès : lecture publique, écriture admin ----------
alter table public.site_content enable row level security;
alter table public.pages        enable row level security;
alter table public.services     enable row level security;
alter table public.cities       enable row level security;
alter table public.settings     enable row level security;

drop policy if exists "contenu: lecture" on public.site_content;
create policy "contenu: lecture" on public.site_content for select using (true);
drop policy if exists "contenu: admin" on public.site_content;
create policy "contenu: admin" on public.site_content for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pages: lecture" on public.pages;
create policy "pages: lecture" on public.pages for select using (published or public.is_admin());
drop policy if exists "pages: admin" on public.pages;
create policy "pages: admin" on public.pages for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "services: lecture" on public.services;
create policy "services: lecture" on public.services for select using (true);
drop policy if exists "services: admin" on public.services;
create policy "services: admin" on public.services for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "communes: lecture" on public.cities;
create policy "communes: lecture" on public.cities for select using (true);
drop policy if exists "communes: admin" on public.cities;
create policy "communes: admin" on public.cities for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "réglages: lecture" on public.settings;
create policy "réglages: lecture" on public.settings for select using (true);
drop policy if exists "réglages: admin" on public.settings;
create policy "réglages: admin" on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. Fonctions réservées à l'admin ----------
create or replace function public.admin_users()
returns table (
  id uuid, email text, role text, first_name text, last_name text, island text, city text, phone text,
  suspended boolean, created_at timestamptz, last_sign_in_at timestamptz, helper_status text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select p.id, u.email::text, p.role, p.first_name, p.last_name, p.island, p.city, p.phone,
           p.suspended, p.created_at, u.last_sign_in_at, h.status
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.helpers h on h.id = p.id
    order by p.created_at desc;
end $$;

create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select jsonb_build_object(
    'users',    coalesce((select jsonb_object_agg(role, n) from (select role, count(*) n from public.profiles group by role) s), '{}'::jsonb),
    'helpers',  coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.helpers group by status) s), '{}'::jsonb),
    'bookings', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.bookings group by status) s), '{}'::jsonb),
    'signups_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'escrow_eur_cents', (select coalesce(sum(amount_cents), 0) from public.bookings where payment_status = 'paid' and currency = 'eur'),
    'monthly', (
      select coalesce(jsonb_agg(x.m order by x.m->>'month'), '[]'::jsonb) from (
        select jsonb_build_object(
          'month',    to_char(d, 'YYYY-MM'),
          'signups',  (select count(*) from public.profiles where date_trunc('month', created_at) = d),
          'bookings', (select count(*) from public.bookings where date_trunc('month', created_at) = d),
          'paid_eur_cents', (select coalesce(sum(amount_cents), 0) from public.bookings
                             where currency = 'eur' and paid_at is not null and payment_status in ('paid','released')
                               and date_trunc('month', paid_at) = d),
          'commission_eur_cents', (select coalesce(sum(amount_cents - helper_payout_cents), 0) from public.bookings
                             where currency = 'eur' and payment_status = 'released'
                               and date_trunc('month', released_at) = d)
        ) as m
        from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') d
      ) x
    )
  ) into r;
  return r;
end $$;

revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_stats() to authenticated;
revoke execute on function public.guard_profile() from public, anon, authenticated;

-- ---------- 5. Données de départ (non écrasées si déjà présentes) ----------
insert into public.services (id, label, description, sort) values
  ('garde',     'Garde d''enfants',       'Nounous, baby-sitters, sortie d''école', 1),
  ('courses',   'Courses & commissions',  'Supermarché, marché forain, pharmacie',  2),
  ('seniors',   'Aide aux seniors',       'Compagnie, repas, rendez-vous médicaux', 3),
  ('menage',    'Ménage & repassage',     'Entretien de la maison, linge',          4),
  ('soutien',   'Soutien scolaire',       'Primaire, collège, lycée',               5),
  ('bricolage', 'Bricolage & jardin',     'Petits travaux, entretien la kour',      6)
on conflict (id) do nothing;

insert into public.cities (island, name, sort)
select 'RE', n, row_number() over () from unnest(array[
  'Saint-Denis','Sainte-Marie','Sainte-Suzanne','Saint-André','Bras-Panon','Saint-Benoît','Saint-Pierre',
  'Le Tampon','Saint-Louis','Saint-Joseph','Saint-Paul','Le Port','La Possession','Saint-Leu']) n
on conflict (island, name) do nothing;

insert into public.cities (island, name, sort)
select 'MU', n, row_number() over () from unnest(array[
  'Port Louis','Beau Bassin-Rose Hill','Quatre Bornes','Vacoas-Phoenix','Curepipe','Moka','Grand Baie',
  'Flacq','Mahébourg','Tamarin']) n
on conflict (island, name) do nothing;

insert into public.settings (key, value) values
  ('commission', '0.15'::jsonb),
  ('checks', '{"RE":["Identité vérifiée","Casier judiciaire B3","Agrément PMI","Diplôme vérifié","Assurance RC"],
               "MU":["Identité vérifiée","Certificate of Character","Références vérifiées","Diplôme vérifié"]}'::jsonb)
on conflict (key) do nothing;

-- Pages légales en brouillon (non publiées) : à compléter puis publier depuis l'Admin
insert into public.pages (slug, title, sort, body) values
('mentions-legales', 'Mentions légales', 1,
'# Éditeur du site
Le site koudmen.re est édité par [NOM ET PRÉNOM], entrepreneur individuel.
- SIREN : [NUMÉRO SIREN]
- Adresse : [ADRESSE]
- E-mail : koudmen.reunion@gmail.com
- Directeur de la publication : [NOM ET PRÉNOM]

# Hébergement
Site hébergé par Netlify, Inc. (États-Unis), www.netlify.com.
Données hébergées par Supabase, sur des serveurs situés dans l''Union européenne (Paris).

# Propriété intellectuelle
La marque Koudmen, le logo et les contenus du site sont la propriété de l''éditeur. Toute reproduction sans autorisation est interdite.'),

('conditions-generales', 'Conditions générales d''utilisation', 2,
'**Brouillon à faire valider par un juriste avant publication.**

# Objet
Koudmen est une plateforme de mise en relation entre des particuliers (les « familles ») et des prestataires indépendants (les « aidants ») pour des services du quotidien à La Réunion et à Maurice. Koudmen n''est pas l''employeur des aidants et n''exécute pas les prestations.

# Inscription et vérification
Les aidants sont vérifiés avant d''être visibles : identité, casier judiciaire ou certificat de moralité, diplômes déclarés. Koudmen peut refuser ou suspendre un compte qui ne respecte pas ces conditions.

# Demandes et paiement
La famille envoie une demande ; l''aidant l''accepte ou la refuse. Une fois la demande acceptée, la famille paie en ligne. Le paiement est conservé par Koudmen jusqu''à la confirmation de fin de mission, puis versé à l''aidant, déduction faite de la commission de Koudmen ([COMMISSION] %).

# Annulation et remboursement
Voir la page « Annulation et remboursement ».

# Responsabilité
Chaque aidant est responsable des prestations qu''il réalise. En cas de litige, contactez Koudmen : l''équipe peut suspendre le versement le temps de l''examen.

# Données personnelles
Voir la page « Politique de confidentialité ».'),

('annulation-remboursement', 'Annulation et remboursement', 3,
'**Brouillon à faire valider par un juriste avant publication.**

- Avant le paiement, la famille comme l''aidant peuvent annuler une demande sans frais.
- Après le paiement et avant la mission, la famille peut annuler depuis son tableau de bord : elle est remboursée intégralement.
- Après la mission, le paiement est versé à l''aidant lorsque la famille confirme que tout s''est bien passé. En cas de problème, contactez Koudmen avant de confirmer.
- Les remboursements sont effectués sur le moyen de paiement utilisé, sous 5 à 10 jours ouvrés selon la banque.'),

('confidentialite', 'Politique de confidentialité', 4,
'**Brouillon à faire valider avant publication.**

# Données collectées
Nom, prénom, e-mail, téléphone, commune, et pour les aidants : présentation, tarifs, services. Les documents de vérification (identité, casier) sont contrôlés mais ne sont pas stockés sur la plateforme.

# Utilisation
Ces données servent uniquement à la mise en relation, au suivi des demandes et au paiement. Le téléphone n''est communiqué à l''autre partie qu''après acceptation d''une demande.

# Paiements
Les paiements sont traités par Stripe. Koudmen n''a jamais accès aux numéros de carte bancaire.

# Vos droits
Vous pouvez demander l''accès, la rectification ou la suppression de vos données à koudmen.reunion@gmail.com.'),

('contact', 'Contact', 5,
'Une question, un problème avec une mission ?

- E-mail : koudmen.reunion@gmail.com
- WhatsApp : [NUMÉRO]

Nous répondons sous 24 h ouvrées.')
on conflict (slug) do nothing;
