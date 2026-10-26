# Koudmen — app web

Plateforme de mise en relation entre familles et aidants vérifiés, à La Réunion et à Maurice.
App web installable sur téléphone (PWA), hébergée gratuitement.

- **Interface** : React + Vite, page statique hébergée sur **Cloudflare Pages** (gratuit)
- **Comptes, base de données, sécurité** : **Supabase** (offre gratuite)
- **Paiement en ligne avec séquestre** : **Stripe Connect** (aucun abonnement, frais prélevés uniquement sur les paiements)
- **Coût mensuel fixe** : 0 € (hors nom de domaine)

## Ce que fait cette première version

| Pour qui | Fonctionnalités |
|---|---|
| Familles | Recherche d'aidants vérifiés par île, service et commune · fiche détaillée · demande de mission · **paiement en ligne par carte une fois la demande acceptée** · confirmation de fin de mission qui déclenche le versement · annulation avec remboursement intégral avant la mission · coordonnées et bouton WhatsApp de l'aidant |
| Aidants | Compte et fiche (services, tarif, commune, langues, présentation) · **inscription au versement via Stripe** · demandes reçues · suivi des montants en séquestre et déjà versés |
| Vous (admin) | Vérification des fiches · **suivi des paiements en séquestre, versement ou remboursement en cas de litige** |

### Comment fonctionne le paiement

1. La famille envoie une demande, l'aidant l'accepte.
2. La famille paie en ligne (carte bancaire, page sécurisée Stripe). **L'argent reste sur le compte Koudmen.**
3. Après la mission, l'aidant la marque « terminée ».
4. La famille confirme : Stripe verse à l'aidant le montant **moins 15 %** de commission. Votre commission reste sur votre compte Stripe, puis sur votre compte bancaire.
5. Si la famille annule avant la mission, elle est remboursée intégralement. En cas de litige, vous tranchez depuis l'onglet Admin.

La base de données empêche toute triche : une famille ne peut pas marquer une mission payée, un aidant ne peut pas la marquer terminée sans paiement, et seules les fonctions serveur, protégées par la clé secrète, déplacent l'argent.

Sécurité intégrée à la base de données : un aidant n'apparaît qu'après validation par l'admin, personne ne peut se donner le rôle admin ni valider sa propre fiche, et les numéros de téléphone ne sont visibles par l'autre partie qu'une fois une demande acceptée.

**Volontairement absent de cette version** (pour rester à 0 € et simple) :
- **Envoi de documents** : les pièces d'identité et casiers sont contrôlés par vous en rendez-vous ou en visio, puis **non stockés**. C'est plus sûr au regard du RGPD tant que la plateforme n'a pas de sauvegardes et d'audits de sécurité.
- Avis et notes, messagerie intégrée.

---

## Mise en ligne pas à pas (environ 45 minutes)

### Étape 1 — Créer la base Supabase

1. Créez un compte sur [supabase.com](https://supabase.com) puis **New project**.
   - Nom : `koudmen`
   - Région : **West EU (Paris)** ou **Frankfurt** (données en Europe, RGPD)
   - Notez le mot de passe de la base dans un endroit sûr.
2. Dans le menu de gauche, ouvrez **SQL Editor → New query**.
3. Copiez tout le contenu du fichier `supabase/schema.sql`, collez-le, cliquez **Run**. Le message « Success » doit apparaître.
   Recommencez avec le fichier `supabase/paiements.sql` (nouvelle requête, coller, **Run**).
4. Ouvrez **Authentication → URL Configuration** :
   - **Site URL** : l'adresse de votre site (vous la mettrez à jour à l'étape 3, ex. `https://koudmen.pages.dev`)
   - **Redirect URLs** : ajoutez la même adresse suivie de `/**`
5. Ouvrez **Project Settings → API** et notez :
   - **Project URL** (ex. `https://abcd1234.supabase.co`)
   - **anon public key** (longue clé commençant par `eyJ`)

   La clé `anon` est faite pour être publique : la sécurité repose sur les règles de la base. **Ne mettez jamais la clé `service_role` dans l'app.**

### Étape 2 — Mettre le code sur GitHub

1. Créez un compte sur [github.com](https://github.com) puis un dépôt **privé** nommé `koudmen-web`.
2. Sur la page du dépôt vide, cliquez **uploading an existing file** et glissez tout le contenu de ce dossier **sauf** `node_modules` et `dist` (s'ils existent). Validez avec **Commit changes**.

### Étape 3 — Héberger sur Cloudflare Pages

1. Créez un compte sur [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages → Create → Pages → Connect to Git**, autorisez GitHub et choisissez `koudmen-web`.
3. Réglages de build :
   - **Framework preset** : `Vite` (ou *None*)
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
4. **Environment variables** (avant de lancer le déploiement) :
   - `VITE_SUPABASE_URL` = votre Project URL
   - `VITE_SUPABASE_ANON_KEY` = votre anon public key
   - `VITE_WAITLIST_URL` = `https://form.jotform.com/262983098728071` (facultatif)
5. **Save and Deploy**. Au bout de 1 à 2 minutes, votre app est en ligne sur `https://koudmen-web.pages.dev` (ou un nom proche).
6. Retournez à l'étape 1.4 et mettez cette adresse dans **Site URL** et **Redirect URLs** de Supabase.

Chaque fois que vous modifierez un fichier sur GitHub, Cloudflare remettra le site à jour automatiquement.

### Étape 4 — Devenir admin

1. Ouvrez votre app, cliquez **Se connecter → Créer un compte** et inscrivez-vous avec votre e-mail.
2. Confirmez votre e-mail via le lien reçu.
3. Dans Supabase, **SQL Editor → New query**, exécutez (avec votre e-mail) :

   ```sql
   update public.profiles set role = 'admin'
     where id = (select id from auth.users where email = 'votre@email.com');
   ```
4. Rechargez l'app : l'onglet **Admin** apparaît dans le menu.


### Étape 5 — Activer le paiement en ligne (Stripe)

**5a. Créer le compte Stripe**

1. Créez un compte sur [stripe.com](https://stripe.com) au nom de votre structure réunionnaise (pays : **France**). Stripe vous demandera SIRET, identité du dirigeant et IBAN.
2. Dans le tableau de bord Stripe, ouvrez **Connect** et activez-le en choisissant **Plateforme / marketplace**, comptes **Express**. Renseignez le nom « Koudmen », votre logo et la couleur `#00305A` (Paramètres → Connect → Image de marque) : les aidants verront cette identité pendant leur inscription.
3. **Aidants à Maurice** : les versements vers un compte bancaire mauricien passent par les « versements transfrontaliers » de Stripe (comptes destinataires). Demandez au support Stripe de confirmer qu'ils sont activés pour votre compte plateforme **avant** d'inscrire des aidants mauriciens. Si ce n'est pas possible, lancez d'abord La Réunion seule ; Maurice pourra passer par MIPS ou Peach Payments dans une version ultérieure.

Travaillez d'abord en **mode test** (interrupteur « Mode test » en haut de Stripe) : aucun vrai argent ne circule, et vous payez avec la carte `4242 4242 4242 4242`, n'importe quelle date future et n'importe quel code.

**5b. Installer les 4 fonctions serveur dans Supabase**

Dans Supabase, menu **Edge Functions → Deploy a new function → Via Editor**. Pour chacun des 4 dossiers de `supabase/functions/` :

| Nom de la fonction (exactement) | Fichier à coller |
|---|---|
| `stripe-onboard` | `supabase/functions/stripe-onboard/index.ts` |
| `create-checkout` | `supabase/functions/create-checkout/index.ts` |
| `payment-action` | `supabase/functions/payment-action/index.ts` |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` |

Donnez le nom, remplacez tout le code d'exemple par le contenu du fichier, cliquez **Deploy function**.

Pour **`stripe-webhook` uniquement** : ouvrez la fonction → **Details** (ou Settings) et **désactivez « Enforce JWT verification »**. Stripe l'appelle sans être connecté ; la sécurité repose sur la signature Stripe.

**5c. Déclarer les points de réception Stripe (webhooks)**

L'adresse de votre fonction est : `https://VOTRE-PROJET.supabase.co/functions/v1/stripe-webhook` (remplacez par votre Project URL).

Dans Stripe, **Développeurs → Webhooks → Ajouter un endpoint**, deux fois avec cette même adresse :

1. **Événements sur votre compte** : cochez `checkout.session.completed` et `checkout.session.expired`. Copiez la **clé secrète de signature** (`whsec_…`).
2. **Événements sur les comptes connectés** : cochez `account.updated`. Copiez sa clé `whsec_…` (différente de la première).

**5d. Renseigner les secrets**

Supabase → **Edge Functions → Secrets** (ou Project Settings → Edge Functions), ajoutez :

| Nom | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Développeurs → Clés API → **Clé secrète** (`sk_test_…` en test, `sk_live_…` en réel) |
| `STRIPE_WEBHOOK_SECRET` | la clé `whsec_…` du point de réception 1 |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | la clé `whsec_…` du point de réception 2 |
| `SITE_URL` | l'adresse de votre app, ex. `https://koudmen-web.pages.dev` (sans `/` final) |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux fonctions, ne les ajoutez pas.

**La clé secrète Stripe ne doit jamais apparaître dans le code de l'app ni sur GitHub.** Elle ne vit que dans ces secrets Supabase.

**5e. Passer en réel**

Quand le parcours test fonctionne : refaites 5c et 5d en **mode réel** de Stripe (nouvelles clés `sk_live_…` et `whsec_…`). Les comptes aidants créés en mode test ne sont pas repris : les aidants refont l'inscription au versement en réel.

### Frais Stripe à connaître

Pas d'abonnement, mais des frais par opération, prélevés sur votre part (vos 15 %) : un pourcentage sur chaque paiement par carte, des frais Connect sur les comptes aidants actifs et sur chaque versement, et des frais de change pour les versements vers Maurice. Consultez les montants à jour sur [stripe.com/fr/pricing](https://stripe.com/fr/pricing) et [stripe.com/fr/connect/pricing](https://stripe.com/fr/connect/pricing), et vérifiez qu'il vous reste une marge sur les petites missions.

### Étape 6 — Tester le parcours complet (en mode test Stripe)

1. Avec un deuxième e-mail, créez un compte **aidant**, complétez **Mon profil** (commune, téléphone) puis la fiche aidant.
2. Sur la fiche aidant, cliquez **Activer mes versements** et remplissez l'inscription Stripe (en mode test, Stripe propose des données de test).
3. Avec votre compte admin, onglet **Admin** : cochez « Identité vérifiée » et validez la fiche.
4. Avec un troisième e-mail, créez un compte **famille**, complétez le profil, cherchez l'aidant et envoyez une demande.
5. Côté aidant : **Tableau de bord → Accepter**.
6. Côté famille : **Payer en ligne**, carte `4242 4242 4242 4242`. Le statut passe à « Payée · en séquestre ».
7. Côté aidant : **Marquer terminée**. Côté famille : **Confirmer la mission**. Le statut passe à « Versée à l'aidant » ; dans Stripe, le virement apparaît dans Connect.

### Étape 7 — Votre nom de domaine (seule dépense fixe)

1. Achetez `koudmen.re` (registrar AFNIC, ex. OVH, Gandi) ou `koudmen.com`.
2. Cloudflare Pages → votre projet → **Custom domains → Set up a domain**, suivez les instructions DNS.
3. Mettez à jour **Site URL** et **Redirect URLs** dans Supabase, et le secret `SITE_URL` des fonctions, avec le nouveau domaine.

---

## Réglages conseillés avant l'ouverture au public

- **E-mails de confirmation** : l'envoi intégré de Supabase est limité à quelques e-mails par heure. Créez un compte gratuit [Brevo](https://www.brevo.com) et renseignez son SMTP dans Supabase **Authentication → Emails → SMTP Settings**. Traduisez aussi les modèles d'e-mails en français dans **Authentication → Email Templates**.
- **Mise en pause** : un projet Supabase gratuit est mis en pause après une semaine sans activité. Il redémarre depuis le tableau de bord Supabase. Passez au plan Pro dès que de vraies familles utilisent l'app chaque jour (sauvegardes quotidiennes incluses).
- **Conditions générales** : elles doivent décrire le séquestre, la commission de 15 %, les règles d'annulation et de remboursement. En tant que plateforme établie dans l'UE qui encaisse pour des prestataires, Koudmen est aussi concernée par la déclaration annuelle des revenus des aidants (directive DAC7) : à valider avec votre expert-comptable.
- **Mentions légales et politique de confidentialité** : obligatoires avant l'ouverture (RGPD côté Réunion, Data Protection Act 2017 côté Maurice). À rédiger avec votre conseil juridique.

## Développer en local (facultatif)

Nécessite [Node.js](https://nodejs.org) 18 ou plus.

```bash
cp .env.example .env      # puis remplissez les deux valeurs Supabase
npm install
npm run dev               # ouvre http://localhost:5173
```

## Organisation du code

```
supabase/schema.sql        Tables, règles d'accès, contrôles de sécurité
supabase/paiements.sql     Colonnes et règles du paiement en ligne
supabase/functions/        Fonctions serveur Stripe (inscription aidant, paiement, webhook, versement/remboursement)
src/lib/data.js            Services, îles, communes, vérifications, formats
src/lib/auth.jsx           Session et profil de l'utilisateur
src/pages/Home.jsx         Accueil et recherche
src/pages/HelperProfile.jsx Fiche aidant et demande de mission
src/pages/Login.jsx        Connexion, inscription, mot de passe oublié
src/pages/Account.jsx      Mon profil
src/pages/HelperForm.jsx   Fiche aidant (création, modification)
src/pages/Dashboard.jsx    Demandes reçues et envoyées
src/pages/Admin.jsx        Vérification des aidants
public/                    Icônes, manifeste PWA, redirections
```

Pour ajouter une commune, un service ou une langue, modifiez `src/lib/data.js`.

## Prochaines étapes (version 2)

1. Versement automatique si la famille ne confirme pas sous 72 h (tâche planifiée).
2. Avis après mission terminée.
3. Avance immédiate du crédit d'impôt (API URSSAF Tiers de prestation).
4. Paiement mobile à Maurice (MCB Juice via MIPS ou Peach Payments).
5. Notifications automatiques (e-mail, puis WhatsApp Business).
