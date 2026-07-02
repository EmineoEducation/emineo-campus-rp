# emineo-campus-rp — Hub Campus / RP

Source de vérité unique pour le mapping campus → responsables pédagogiques,
lue par les 18 PAC (`api/send-portfolio.js`) et les 4 portails titre
(déroulante campus). Remplace les listes codées en dur dans 22 fichiers.

## Déploiement (une seule fois)

1. Créer un nouveau repo GitHub `emineo-campus-rp`, y déposer tous les
   fichiers de ce dossier (structure telle quelle, avec le sous-dossier `api/`).
2. Importer ce repo dans Vercel (comme pour n'importe quel PAC).
3. Variables d'environnement à ajouter sur ce projet Vercel :
   - `UPSTASH_REDIS_REST_URL` — **réutiliser la même valeur que sur n'importe
     quel bloc existant** (ex: lumio-bc1). C'est la même base Redis, juste un
     nouveau préfixe de clé (`campus-rp:data`), donc aucun risque de collision
     avec les sessions étudiantes.
   - `UPSTASH_REDIS_REST_TOKEN` — idem, copier depuis un bloc existant.
   - `ADMIN_PASSWORD` — choisir un mot de passe pour la page `/` (admin).
     N'importe quelle chaîne, à changer si besoin plus tard sans redéployer
     (juste éditer la variable + redeploy, comme d'habitude).
4. Redéployer une fois les variables ajoutées (Vercel → Deployments → Redeploy).

## Vérifier que ça marche

- `https://emineo-campus-rp.vercel.app/` → page d'admin, demande le mot de passe.
- `https://emineo-campus-rp.vercel.app/api/campus-rp` → JSON public, doit
  déjà contenir Paris / Nantes / Bordeaux / Le Mans au premier appel (auto-amorçage).

## Si Vercel attribue un domaine différent

Les 22 fichiers consommateurs (18 `send-portfolio.js` + 4 portails) pointent
en dur vers `https://emineo-campus-rp.vercel.app/api/campus-rp`. Si le nom de
domaine réel diffère, il suffit de me donner l'URL exacte : c'est une seule
constante (`CAMPUS_RP_HUB` ou `CAMPUS_RP_HUB_URL`) à changer dans chacun des
22 fichiers, je repackage en une passe.

## Ajouter / modifier un campus ensuite

Tout se fait depuis la page `/` — aucun fichier à toucher, aucun redéploiement
des 18 PAC ni des 4 portails. Le changement est visible dès le prochain
chargement de portail ou envoi de portfolio.
