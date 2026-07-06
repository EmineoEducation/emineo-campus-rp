// ============================================================
//  ÉMINÉO — api/campus-rp.js
//  Endpoint PUBLIC de lecture — retourne la table campus → RP,
//  résolue pour un titre donné (?titre=MSMC|CDRH|MMD|MDO).
//
//  Un campus a un jeu de RP "par défaut", et peut avoir des
//  exceptions par titre (rp_overrides). Si ?titre= n'est pas
//  fourni (cas des 4 portails, qui n'ont besoin que de id+label),
//  le défaut est renvoyé.
//
//  Réponse : { campuses: [ { id, label, rp: [ { nom, email } ] } ] }
//  (même forme qu'avant — les 18 send-portfolio.js n'ont qu'à
//  ajouter ?titre=XXX à l'URL, rien d'autre à changer côté lecture.)
// ============================================================

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY    = 'campus-rp:data';

const SEED_DATA = {
  campuses: [
    { id: 'paris', label: 'Paris', rp_default: [
      { nom: 'Chloé Guyot', email: 'chloe.guyot@cesacom.fr' },
      { nom: 'Céline Mahéo', email: 'celine.maheo@cesacom.fr' },
    ], rp_overrides: {} },
    { id: 'nantes', label: 'Nantes', rp_default: [
      { nom: 'Manon Parageaud', email: 'manon.parageaud@cesacom.fr' },
      { nom: 'Lara Naccache', email: 'lara.naccache@emineo-education.fr' },
    ], rp_overrides: {} },
    { id: 'bordeaux', label: 'Bordeaux', rp_default: [
      { nom: 'Anthony Nabli', email: 'anthony.nabli@emineo-education.fr' },
    ], rp_overrides: {} },
    { id: 'le mans', label: 'Le Mans', rp_default: [
      { nom: 'Johnny Nicolas', email: 'johnny.nicolas@isme.fr' },
    ], rp_overrides: {
      MSMC: [ { nom: 'Etienne Azerad', email: 'etienne.azerad@cesacom.fr' } ],
    } },
  ],
};

// Rétrocompatibilité : normalise une entrée qu'elle vienne de l'ancien
// format ({ id, label, rp }) ou du nouveau ({ id, label, rp_default, rp_overrides }).
function normalizeCampus(c) {
  return {
    id: c.id,
    label: c.label,
    rp_default: Array.isArray(c.rp_default) ? c.rp_default : (Array.isArray(c.rp) ? c.rp : []),
    rp_overrides: (c.rp_overrides && typeof c.rp_overrides === 'object') ? c.rp_overrides : {},
  };
}

function resolveForTitre(campus, titre) {
  const rp = (titre && campus.rp_overrides && campus.rp_overrides[titre])
    ? campus.rp_overrides[titre]
    : campus.rp_default;
  return { id: campus.id, label: campus.label, rp };
}

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  if (!r.ok) throw new Error('Redis GET non-OK: ' + r.status);
  const data = await r.json();
  return data.result;
}

async function redisSet(key, value) {
  const r = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error('Redis SET non-OK: ' + r.status);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const titre = (req.query && req.query.titre) ? String(req.query.titre).toUpperCase() : null;

  const resolveAndReply = (rawCampuses) => {
    let campuses = (rawCampuses || []).map(normalizeCampus).map(c => resolveForTitre(c, titre));
    // Un campus sans RP pour le titre demandé n'est pas proposé — permet d'ouvrir
    // un campus sur un seul titre (rp_default vide + override sur ce titre uniquement).
    // Les appels sans ?titre (portails, qui n'ont besoin que de id+label) voient tout.
    if (titre) campuses = campuses.filter(c => Array.isArray(c.rp) && c.rp.length > 0);
    return res.status(200).json({ campuses });
  };

  if (!REDIS_URL || !REDIS_TOKEN) {
    console.warn('UPSTASH non configuré sur emineo-campus-rp — seed statique servi, non éditable.');
    return resolveAndReply(SEED_DATA.campuses);
  }

  try {
    const raw = await redisGet(REDIS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return resolveAndReply(parsed.campuses);
    }
    await redisSet(REDIS_KEY, SEED_DATA);
    return resolveAndReply(SEED_DATA.campuses);
  } catch (err) {
    console.error('campus-rp GET error:', err);
    return resolveAndReply(SEED_DATA.campuses);
  }
}
