-- ============================================================
-- KOUDMEN — Optimisation des règles d'accès (audit Supabase)
-- Mêmes règles qu'avant, écrites pour être évaluées une seule fois par requête.
-- À exécuter après backoffice.sql. Peut être relancé sans danger.
-- ============================================================

-- Profils
drop policy if exists "profil: lire le sien" on public.profiles;
create policy "profil: lire le sien" on public.profiles for select
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profil: modifier le sien" on public.profiles;
create policy "profil: modifier le sien" on public.profiles for update
  using (id = (select auth.uid()) or (select public.is_admin()));

-- Aidants
drop policy if exists "aidant: lire vérifiés" on public.helpers;
create policy "aidant: lire vérifiés" on public.helpers for select
  using ((status = 'verified' and not public.is_suspended(id)) or id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "aidant: créer le sien" on public.helpers;
create policy "aidant: créer le sien" on public.helpers for insert
  with check (id = (select auth.uid()));
drop policy if exists "aidant: modifier le sien" on public.helpers;
create policy "aidant: modifier le sien" on public.helpers for update
  using (id = (select auth.uid()) or (select public.is_admin()));

-- Demandes
drop policy if exists "demande: lire les siennes" on public.bookings;
create policy "demande: lire les siennes" on public.bookings for select
  using ((select auth.uid()) in (family_id, helper_id) or (select public.is_admin()));
drop policy if exists "demande: créer" on public.bookings;
create policy "demande: créer" on public.bookings for insert
  with check (
    family_id = (select auth.uid())
    and helper_id <> (select auth.uid())
    and not public.is_suspended((select auth.uid()))
    and exists (select 1 from public.helpers h where h.id = helper_id and h.status = 'verified' and h.payments_ready)
  );
drop policy if exists "demande: mettre à jour" on public.bookings;
create policy "demande: mettre à jour" on public.bookings for update
  using ((select auth.uid()) in (family_id, helper_id) or (select public.is_admin()));

-- Versements
drop policy if exists "versement: lire le sien" on public.helper_payouts;
create policy "versement: lire le sien" on public.helper_payouts for select
  using (id = (select auth.uid()) or (select public.is_admin()));

-- Contenus : une règle de lecture, et des règles d'écriture séparées réservées à l'admin
do $$
declare t text; r text;
begin
  foreach t in array array['site_content','services','cities','settings','pages'] loop
    r := case t when 'site_content' then 'contenu' when 'services' then 'services' when 'cities' then 'communes'
                when 'settings' then 'réglages' else 'pages' end;
    execute format('drop policy if exists %I on public.%I', r || ': admin', t);
    execute format('drop policy if exists %I on public.%I', r || ': ajout', t);
    execute format('drop policy if exists %I on public.%I', r || ': modification', t);
    execute format('drop policy if exists %I on public.%I', r || ': suppression', t);
    execute format('create policy %I on public.%I for insert with check ((select public.is_admin()))', r || ': ajout', t);
    execute format('create policy %I on public.%I for update using ((select public.is_admin())) with check ((select public.is_admin()))', r || ': modification', t);
    execute format('create policy %I on public.%I for delete using ((select public.is_admin()))', r || ': suppression', t);
  end loop;
end $$;

drop policy if exists "pages: lecture" on public.pages;
create policy "pages: lecture" on public.pages for select using (published or (select public.is_admin()));
