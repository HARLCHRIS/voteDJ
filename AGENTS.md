# Règles de développement – DJ Challenge (Eat & Drink Festival Cotonou)

## Stack imposée
- **Framework** : Next.js (App Router) + TypeScript strict
- **UI** : Tailwind CSS + shadcn/ui (Lucide React pour les icônes)
- **Backend / BDD / Auth** : Supabase (PostgreSQL, Supabase Auth, RLS, RPC PostgreSQL, Edge Functions, Supabase Realtime pour l'admin)
- **Sécurité** : Cloudflare Turnstile + Rate Limiting + Liaison 1 compte Google ↔ 1 appareil

## Règles architecturales strictes
1. **Toujours** commencer par les types TypeScript avant le code (`src/types/`).
2. **Toujours** créer les composants dans l'ordre : `types` → `hooks` → `composant UI` → `page`.
3. **Jamais** de `any` en TypeScript (utiliser `unknown`, des génériques ou des types stricts dérivés de `Database`).
4. **Toujours** ajouter des commentaires JSDoc sur les fonctions complexes.
5. **Toujours** gérer les 3 états (`loading` / `success` / `error`) dans chaque hook et interface.
6. **Toujours** vérifier le rôle utilisateur (`admin` / `super_admin` / `moderator` vs `voter` / `visitor`) avant d'afficher une page protégée.
7. **Jamais** dupliquer la logique → extraire dans des hooks personnalisés (`src/hooks/`) ou utilitaires (`src/lib/`).
8. **Aucune clé secrète côté client** : `SUPABASE_SERVICE_ROLE_KEY`, secrets Turnstile et Upstash restent strictement côté serveur.
9. **RLS obligatoire sur toutes les tables** : les votants ne peuvent jamais lire ni modifier directement `public_scores`, `voters`, `devices`, `score_aggregates`, `performance_results` et `audit_logs`.

## Direction visuelle (« VOTE » Poster + Logos Festival)
- Palette inspirée de l'affiche de référence :
  - Vert forêt profond : `#063B1B` → Vert émeraude : `#0E6B32`
  - Vert sombre cartouche : `#09421A`
  - Vert lime festival / coche : `#76E000` / `#28C840`
  - Jaune lime nom du DJ : `#D9E81B`
  - Rouge bordeaux accent prime : `#8B1A1A`
- Composition en couches : fond dégradé vert + mur typographique triple « VOTE » incliné + portrait DJ au premier plan + badges coche 3D + cartouche identitaire bicolore incliné + 5 boutons tactiles de notation `2, 4, 6, 8, 10`.
- Exploiter les 2 logos officiels dans `public/images/` :
  - `logo-days-party.png` (vinyle fondant Days Party – Eat & Drink Cotonou Festival)
  - `logo-eat-drink-2027.png` (Toucan 8e édition – 26 > 31 Janvier 2027)

