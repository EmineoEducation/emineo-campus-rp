# emineo-campus-rp — Hub Campus / RP (v2 — support par titre)

Source de vérité unique pour le mapping campus → responsables pédagogiques,
lue par les 18 PAC (`api/send-portfolio.js`) et les 4 portails titre.

**Nouveau dans cette version :** un campus a un RP « par défaut », et peut
avoir des **exceptions par titre** (ex: Le Mans → Johnny Nicolas par défaut,
sauf en MSMC où Etienne Azerad reste le RP).

## Mise à jour d'un déploiement existant

Remplace les 3 fichiers (`api/campus-rp.js`, `api/admin.js`, `index.html`)
dans le repo GitHub `emineo-campus-rp` existant, puis redeploy sur Vercel.
Aucune variable d'environnement supplémentaire n'est nécessaire.

**Rétrocompatibilité :** si des campus étaient déjà enregistrés dans
l'ancien format (un seul RP par campus, sans distinction de titre), ils
continuent de fonctionner tels quels — le nouveau code les lit
normalement. Ils passent au nouveau format dès qu'on les édite une fois
via la page `/`.

## Nouveau déploiement (si pas encore fait)

1. Repo GitHub `emineo-campus-rp` avec tous les fichiers de ce dossier.
2. Import Vercel, variables d'environnement :
   - `UPSTASH_REDIS_REST_URL` — réutiliser la valeur d'un bloc existant.
   - `UPSTASH_REDIS_REST_TOKEN` — idem.
   - `ADMIN_PASSWORD` — mot de passe de la page `/`.
3. Redeploy.

## Utiliser une exception par titre

Sur la page `/`, en éditant un campus : sous « Exceptions par titre »,
cocher le titre concerné (MSMC / CDRH / MMD / MDO), renseigner le ou les
RP spécifiques à ce titre pour ce campus. Les titres non cochés utilisent
le RP par défaut.

## Cas Le Mans (à faire une fois le hub à jour)

Éditer « Le Mans » :
- RP par défaut : Johnny Nicolas — johnny.nicolas@isme.fr
- Cocher MSMC, y indiquer : Etienne Azerad — etienne.azerad@cesacom.fr

## Vérifier

`https://emineo-campus-rp.vercel.app/api/campus-rp?titre=MSMC` doit
renvoyer Etienne Azerad pour Le Mans.
`https://emineo-campus-rp.vercel.app/api/campus-rp?titre=CDRH` (ou MMD,
MDO, ou sans paramètre) doit renvoyer Johnny Nicolas pour Le Mans.
