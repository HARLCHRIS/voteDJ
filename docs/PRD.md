# PRD et stack technique – Plateforme de vote DJ Challenge

*Version 1.8 – Notation par passage de DJ, stack Supabase, à développer avec Google Antigravity*

## 1. Contexte et objectif

Le festival organise un challenge de sélection de DJ en deux **primes**. Dans chaque prime, les DJ passent **l'un après l'autre en direct**. Pendant le passage d'un DJ, le public lui attribue une note sur la plateforme, après une connexion Google. À la fin, l'admin communique les résultats du public au jury, qui délibère hors plateforme et désigne les DJ qualifiés pour la suite, jusqu'à la sélection finale du line-up.

**Objectif produit :** fournir une plateforme de notation en direct, gratuite, fiable et résistante à la fraude, où le public ne note que le DJ qui est sur scène, utilisable sur mobile avec une connexion limitée.

**Indicateurs de succès**

- Le DJ en cours s'affiche chez les votants en moins de 5 secondes après son lancement par l'admin.
- Un votant déjà connecté note en moins de 10 secondes après l'ouverture d'un passage (la connexion se fait avant, sur l'écran d'attente).
- Connexion Google réussie du premier coup pour au moins 90 % des votants, y compris depuis un lien partagé sur WhatsApp.
- Page de notation chargée en moins de 3 secondes sur 3G/4G.
- Plus de 95 % des notes valides enregistrées sans erreur pendant un pic de trafic.
- Moins de 2 % de notes frauduleuses détectées après audit.
- Moyennes et classement du public visibles en direct dans le tableau de bord admin, avec moins de 5 secondes de retard.

## 2. Utilisateurs

| Rôle | Description | Besoins principaux |
| --- | --- | --- |
| Votant (public) | Fan, sur place ou à distance, sur mobile, avec un compte Google | Se connecter une seule fois, puis noter en quelques secondes le DJ en cours |
| Jury | Professionnels désignés par l'organisation | Évaluent les DJ hors plateforme, sur fiche papier ; aucun accès à la plateforme |
| Administrateur | Organisateur du festival, régie | Enregistrer les DJ, gérer les primes, ouvrir et clôturer chaque passage, suivre les résultats du public en direct et les communiquer au jury, détecter la fraude |
| Visiteur | Tout le monde | Voir les primes, les DJ et les qualifiés |

## 3. Périmètre

### Inclus (MVP)

- Enregistrement des DJ par l'admin (nom et prime obligatoires, formulaire rapide, import CSV facultatif), modification du nom et de la prime à la demande, et gestion de l'ordre de passage.
- Présentation des primes et des DJ (nom de scène obligatoire ; photo, bio, extrait vidéo/audio facultatifs).
- Adresse courte unique et permanente d'accès à la plateforme (le QR code est créé hors plateforme).
- Connexion Google des votants, une seule fois par prime.
- Notation publique gratuite (2, 4, 6, 8 ou 10), uniquement pour le DJ dont le passage est ouvert.
- Régie live : l'admin ouvre, clôture et enchaîne manuellement les passages.
- Anti-fraude : un compte Google = un votant, un appareil = un compte, Turnstile, limitation de débit.
- Moyennes et classement du public en direct dans le tableau de bord admin.
- Marquage manuel des qualifiés par l'admin.
- Export CSV.

### Hors périmètre (v2)

- Votes payants ou Mobile Money.
- Génération, gestion ou suivi du QR code : il est créé hors plateforme et pointe vers l'adresse courte.
- Connexion par téléphone, OTP ou SMS : seule la connexion Google est proposée.
- Transfert d'appareil automatique : un changement de téléphone passe par l'admin.
- Affichage des résultats du public aux votants : les résultats restent dans le tableau de bord admin.
- Gestion des égalités : aucun départage dans la plateforme.
- Gestion du jury, saisie de ses notes et pondération public/jury : traitées hors plateforme.
- Notation par USSD, SMS ou bot WhatsApp.
- Application mobile native.

## 4. Règles métier

1. Un **événement** (le challenge) contient deux **primes**. Chaque prime a une liste ordonnée de DJ qui passent chacun à leur tour : un **passage** par DJ.
2. L'admin enregistre lui-même tous les DJ, au nombre de 25, par un formulaire rapide ; l'import CSV est facultatif. Deux informations sont obligatoires : le **nom de scène** et la **prime** (prime 1 ou prime 2). Le passage du DJ est créé automatiquement dans cette prime.
3. L'admin peut modifier le nom d'un DJ à tout moment, et sa prime tant que son passage n'a pas été ouvert. Une fois le passage ouvert, la prime est verrouillée pour protéger les notes déjà données. Chaque modification est journalisée.
4. Le public ne peut noter que le DJ dont le passage est **ouvert**. Un seul passage est ouvert à la fois par prime ; ouvrir le suivant ferme le précédent.
5. L'admin ouvre et clôture chaque passage **manuellement** depuis la régie. Il n'y a pas de clôture automatique.
6. Chaque votant donne **une note par passage**, parmi 2, 4, 6, 8 ou 10. Il peut la modifier tant que le passage est ouvert ; elle est figée à la clôture.
7. Le votant se connecte avec un **compte Google**, une seule fois, avant le premier passage. Un compte Google = un votant.
8. Chaque appareil est lié à **un seul compte Google** dès la première connexion. Un compte ne note que depuis son appareil lié, et un appareil ne sert qu'à un seul compte. Il n'y a pas de transfert automatique : l'admin peut délier un appareil au cas par cas (voir section 6.2).
9. Le jury évalue les DJ **hors plateforme**, sur fiches papier. La plateforme ne gère ni les jurés, ni leurs notes, ni la pondération entre public et jury.
10. L'état du passage est vérifié côté serveur uniquement : aucune note n'est acceptée pour un passage fermé ou en attente.
11. Les résultats du public ne sont **jamais affichés aux votants**. Ils sont consultables en direct dans le tableau de bord admin, et l'admin les communique au jury lors de sa délibération.
12. Le score du public d'un DJ est la **moyenne** de ses notes valides, pour que le nombre de votants présents pendant un passage n'avantage pas un DJ. Un nombre minimum de notes (paramétrable) est exigé.
13. La plateforme calcule le classement du public. Elle ne gère aucune égalité : deux DJ à moyenne identique apparaissent au même rang et la décision est prise hors plateforme. Après la décision finale, l'admin marque les qualifiés.
14. Un admin peut invalider des notes suspectes avec un motif obligatoire ; l'action est journalisée et les scores sont recalculés.

### Calcul du score du public

Le score d'un DJ est la moyenne des notes valides que le public lui a données, sur 10.

`S_public = (1 / n) * sum(s_i)` avec `s_i ∈ {2, 4, 6, 8, 10}`

## 5. Parcours utilisateurs

### Votant

1. Arrive en scannant le QR code affiché sur place (écran géant, affiches, programme) ou via le lien partagé (WhatsApp, réseaux sociaux). Le QR code et le lien ouvrent toujours la même page, qui affiche automatiquement la prime en cours. Si le lien s'ouvre dans le navigateur intégré d'une application (WhatsApp, Facebook, Instagram), un message l'invite à l'ouvrir dans Chrome ou Safari, car Google bloque la connexion dans ces navigateurs.
2. Se connecte avec Google en un appui, une seule fois pour la prime, de préférence dès l'écran d'attente et avant le début des passages. Une vérification anti-robot invisible a lieu en même temps, et son appareil est lié à son compte.
3. Voit un écran d'attente tant qu'aucun DJ n'est ouvert à la notation.
4. Quand l'admin lance un passage, l'écran affiche automatiquement le DJ sur scène et cinq boutons de note : 2, 4, 6, 8 et 10.
5. Touche sa note : le serveur vérifie sa session et son appareil. Confirmation immédiate, modifiable tant que le passage est ouvert.
6. S'il tente de noter avec un autre compte depuis le même appareil, ou avec son compte depuis un autre appareil, la note est refusée avec un message clair l'invitant à contacter l'organisation.
7. Quand l'admin clôture le passage, l'écran repasse en attente jusqu'au DJ suivant.

### Administrateur

1. Se connecte au back-office (email + mot de passe, 2FA recommandée).
2. Crée les primes, puis enregistre chaque DJ avec son nom et sa prime (formulaire rapide, import CSV facultatif) et fixe l'ordre de passage. Corrige un nom ou une prime sur demande.
3. Le jour J, ouvre le passage du premier DJ ; le public voit ce DJ.
4. Clôture le passage manuellement, puis ouvre le suivant ; suit en direct le nombre de notes reçues et les alertes fraude.
5. Consulte à tout moment les moyennes et le classement du public dans le tableau de bord, et les communique au jury lors de sa délibération.
6. Invalide les notes suspectes et vérifie les appareils signalés.
7. Une fois la décision prise avec le jury (hors plateforme), marque les qualifiés.
8. Exporte les résultats et le journal d'audit.

## 6. Exigences fonctionnelles

### 6.1 Site public

- **FR-1** Page d'accueil : prime en cours, prochaines primes, qualifiés des primes précédentes.
- **FR-2** Page de prime en direct, accessible par une adresse courte et permanente, la même pour tout le monde : bouton de connexion Google et écran d'attente, puis DJ en cours avec ses boutons de note, mis à jour automatiquement.
- **FR-3** Fiche DJ : nom de scène et, en option, photo, bio, genre, vidéo ou lien SoundCloud/YouTube.
- **FR-4** Notation en un geste : un appui sur l'une des cinq notes (2, 4, 6, 8, 10), sans formulaire.
- **FR-5** Modification de la note tant que le passage est ouvert, avec le nom du DJ noté toujours visible.
- **FR-6** Page des qualifiés : DJ qualifiés de chaque prime, publiée par l'admin. Aucun résultat de notation n'est affiché au public.
- **FR-7** Interface en français (prête pour l'anglais), mobile-first, légère.

### 6.2 Identification et anti-fraude

- **FR-8** Connexion avec **Google uniquement** (Supabase Auth), une seule fois par prime ; la session reste active pendant toute la prime. Seuls les scopes de base (openid, email, profile) sont demandés.
- **FR-9** Détection du navigateur intégré (WhatsApp, Facebook, Instagram, TikTok) avec le message « Ouvrez ce lien dans Chrome ou Safari » et un bouton pour copier le lien.
- **FR-10** Contrainte d'unicité en base : une seule note par (votant, passage), et seules les valeurs 2, 4, 6, 8 et 10 sont acceptées.
- **FR-11** Cloudflare Turnstile en mode invisible à la connexion ; limitation de débit par compte, par IP et par appareil.
- **FR-12** **Un compte Google = un votant, un appareil = un compte** : le serveur vérifie la session et l'appareil à chaque note.
- **FR-13** Détection d'anomalies : rafales de 10 ou de 2 pour un même DJ, nombreux nouveaux comptes depuis une même IP ou un même appareil, comptes créés en série.
- **FR-14** Journal d'audit immuable de toutes les notes et de tous les événements de compte et d'appareil (horodatage, IP hachée, identifiant d'appareil haché).

### 6.3 Back-office

- **FR-15** Enregistrement des DJ par l'admin (environ 25) : formulaire rapide à deux champs obligatoires (nom de scène et prime), recherche et filtre par prime. Import CSV facultatif (colonnes nom et prime).
- **FR-16** Modification d'un DJ à la demande : le nom reste modifiable à tout moment, la prime seulement tant que son passage n'a pas été ouvert. Chaque modification est journalisée.
- **FR-17** Configuration de l'événement et des deux primes (Prime 1 et Prime 2), et ordre de passage des DJ par glisser-déposer au sein d'une prime.
- **FR-18** Régie live : boutons « Lancer le passage », « Clôturer » et « DJ suivant ».
- **FR-19** Tableau de bord temps réel : DJ en cours, nombre de notes reçues, moyennes et classement du public en direct, alertes fraude, comptes et appareils signalés.
- **FR-20** Blocage/déblocage compte ou appareil, déliaison d'un appareil, invalidation de notes avec motif, marquage des qualifiés, export CSV, rôles super admin et modérateur.

## 8. Stack technique

- Front-end : Next.js (App Router) + TypeScript
- UI : Tailwind CSS + shadcn/ui
- Base de données & Auth & Realtime & Storage : Supabase (PostgreSQL, Supabase Auth, Edge Functions / RPC, Supabase Realtime pour l'admin, Supabase Storage)
- Anti-bot : Cloudflare Turnstile
- Rate limiting : Upstash Redis (ou fallback en mémoire / DB pour le dev)
- Import CSV : Papa Parse
- Tests : Vitest + Playwright

## 10. Modèle de données

- `events` : id, name, slug, start_date, end_date
- `rounds` : id, event_id, name (« Prime 1 » ou « Prime 2 »), order_number, status (draft, scheduled, live, completed), min_scores_required
- `djs` : id, stage_name, real_name, bio, genre, photo_url, media_url, social_links, created_at, updated_at
- `performances` : id, round_id, dj_id, performance_order, status (waiting, open, closed), opened_at, closed_at, is_qualified
- `performance_results` : performance_id, public_avg, public_count, public_rank
- `voters` : id, auth_user_id, auth_provider, created_at, is_blocked
- `devices` : id, voter_id, device_token_hash, fingerprint_hash, status (active, flagged, blocked), ip_hash, user_agent, first_seen_at, last_seen_at
- `device_events` : id, device_id, voter_id, event_type, created_at
- `public_scores` : id, performance_id, voter_id, device_id, score, ip_hash, created_at, updated_at, is_valid, invalidated_reason, invalidated_by
- `score_aggregates` : performance_id, scores_sum, scores_count, updated_at
- `admin_users` : id, auth_user_id, role (super_admin, moderator)
- `audit_logs` : id, actor_id, action, entity, entity_id, metadata, created_at

