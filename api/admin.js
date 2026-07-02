// ============================================================
//  ÉMINÉO — api/admin.js
//  Endpoint PROTÉGÉ (mot de passe) — gère la table campus → RP,
//  avec un jeu de RP par défaut et des exceptions par titre.
//
//  Header requis sur chaque appel : x-admin-password
//
//  GET    → liste complète normalisée { campuses: [...] }
//  POST   → crée/met à jour UNE entrée.
//           Body : { id, label, rp_default: [{nom,email}],
//                     rp_overrides: { MSMC: [{nom,email}], ... } }
//           rp_overrides est optionnel ; une entrée de titre avec un
//           tableau vide est retirée automatiquement (= pas d'exception).
//  DELETE → supprime une entrée. Query : ?id=xxx
// ============================================================

const REDIS_URL      = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN     = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY       = 'campus-rp:data';
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD;
const TITRES_CONNUS   = ['MSMC', 'CDRH', 'MMD', 'MDO'];

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  if (!r.ok) throw new Error('Redis GET non-OK: ' + r.status);
  const data = await r.json();
  return data.result ? JSON.parse(data.result) : { campuses: [] };
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

// Rétrocompatibilité : une entrée ancien format ({ rp: [...] }) est lue
// comme si rp_default = rp, rp_overrides = {}.
function normalizeCampus(c) {
  return {
    id: c.id,
    label: c.label,
    rp_default: Array.isArray(c.rp_default) ? c.rp_default : (Array.isArray(c.rp) ? c.rp : []),
    rp_overrides: (c.rp_overrides && typeof c.rp_overrides === 'object') ? c.rp_overrides : {},
  };
}

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function validRpList(list, label) {
  if (!Array.isArray(list) || list.length === 0) return `${label} : au moins un RP requis`;
  for (const p of list) {
    if (!p.email || !p.email.includes('@')) return `${label} : email invalide ("${p.email || ''}")`;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'ADMIN_PASSWORD non configuré sur ce projet Vercel' });
  }
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: 'UPSTASH_REDIS_REST_URL / TOKEN non configurés sur ce projet Vercel' });
  }

  const pass = req.headers['x-admin-password'];
  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe admin invalide' });
  }

  try {
    if (req.method === 'GET') {
      const current = await redisGet(REDIS_KEY);
      const campuses = (current.campuses || []).map(normalizeCampus);
      return res.status(200).json({ campuses, titres: TITRES_CONNUS });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { id, label, rp_default, rp_overrides } = body || {};

      if (!label) return res.status(400).json({ error: 'Champ requis manquant : label' });

      const err = validRpList(rp_default, 'RP par défaut');
      if (err) return res.status(400).json({ error: err });

      const cleanOverrides = {};
      if (rp_overrides && typeof rp_overrides === 'object') {
        for (const titre of Object.keys(rp_overrides)) {
          const key = titre.toUpperCase();
          if (!TITRES_CONNUS.includes(key)) {
            return res.status(400).json({ error: `Titre inconnu : ${titre} (attendu : ${TITRES_CONNUS.join(', ')})` });
          }
          const list = rp_overrides[titre];
          if (Array.isArray(list) && list.length > 0) {
            const errO = validRpList(list, `Exception ${key}`);
            if (errO) return res.status(400).json({ error: errO });
            cleanOverrides[key] = list;
          }
          // tableau vide ou absent → pas d'exception pour ce titre, on ignore
        }
      }

      const finalId = (id && id.trim()) ? slugify(id) : slugify(label);
      const current = await redisGet(REDIS_KEY);
      const campuses = (current.campuses || []).map(normalizeCampus);
      const idx = campuses.findIndex(c => c.id === finalId);
      const entry = { id: finalId, label: String(label).trim(), rp_default, rp_overrides: cleanOverrides };

      if (idx >= 0) campuses[idx] = entry;
      else campuses.push(entry);

      await redisSet(REDIS_KEY, { campuses });
      return res.status(200).json({ saved: true, campus: entry, campuses });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'Paramètre requis manquant : id' });

      const current = await redisGet(REDIS_KEY);
      const campuses = (current.campuses || []).map(normalizeCampus);
      const before = campuses.length;
      const filtered = campuses.filter(c => c.id !== id);

      if (filtered.length === before) {
        return res.status(404).json({ error: `Campus introuvable : ${id}` });
      }

      await redisSet(REDIS_KEY, { campuses: filtered });
      return res.status(200).json({ deleted: true, campuses: filtered });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin campus-rp error:', err);
    return res.status(500).json({ error: 'Erreur serveur', message: err.message });
  }
}
