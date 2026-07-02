// ============================================================
//  ÉMINÉO — api/campus-rp.js
//  Endpoint PUBLIC de lecture — retourne la table campus → RP
//  utilisée par les 18 PAC (send-portfolio.js) et les 4 portails
//  (déroulante campus). Lecture seule. Écriture réservée à /api/admin.
//
//  Réponse : { campuses: [ { id, label, rp: [ { nom, email } ] } ] }
// ============================================================

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY    = 'campus-rp:data';

// Données de démarrage — utilisées UNE SEULE FOIS si la clé Redis est vide,
// pour ne pas partir d'une liste blanche. Sylvain peut ensuite tout éditer
// via /admin.
const SEED_DATA = {
  campuses: [
    { id: 'paris', label: 'Paris', rp: [
      { nom: 'Chloé Guyot', email: 'chloe.guyot@cesacom.fr' },
      { nom: 'Céline Mahéo', email: 'celine.maheo@cesacom.fr' },
    ]},
    { id: 'nantes', label: 'Nantes', rp: [
      { nom: 'Manon Parageaud', email: 'manon.parageaud@cesacom.fr' },
      { nom: 'Lara Naccache', email: 'lara.naccache@emineo-education.fr' },
    ]},
    { id: 'bordeaux', label: 'Bordeaux', rp: [
      { nom: 'Anthony Nabli', email: 'anthony.nabli@emineo-education.fr' },
    ]},
    { id: 'le mans', label: 'Le Mans', rp: [
      { nom: 'Etienne Azerad', email: 'etienne.azerad@cesacom.fr' },
    ]},
  ],
};

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  if (!r.ok) throw new Error('Redis GET non-OK: ' + r.status);
  const data = await r.json();
  return data.result; // string | null
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

  if (!REDIS_URL || !REDIS_TOKEN) {
    // Pas de Redis configuré — on sert quand même le seed, pour que les
    // 22 consommateurs ne cassent jamais, mais rien n'est persistant.
    console.warn('UPSTASH non configuré sur emineo-campus-rp — seed statique servi, non éditable.');
    return res.status(200).json(SEED_DATA);
  }

  try {
    const raw = await redisGet(REDIS_KEY);
    if (raw) {
      return res.status(200).json(JSON.parse(raw));
    }
    // Rien en base → on amorce avec le seed et on le persiste.
    await redisSet(REDIS_KEY, SEED_DATA);
    return res.status(200).json(SEED_DATA);
  } catch (err) {
    console.error('campus-rp GET error:', err);
    // Résilience : ne jamais faire tomber les 22 consommateurs.
    return res.status(200).json(SEED_DATA);
  }
}
