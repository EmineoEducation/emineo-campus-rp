// ============================================================
//  ÉMINÉO — api/admin.js
//  Endpoint PROTÉGÉ (mot de passe) — gère la table campus → RP.
//  Utilisé uniquement par index.html (page d'admin).
//
//  Header requis sur chaque appel : x-admin-password
//
//  GET    → liste complète { campuses: [...] }
//  POST   → crée/met à jour UNE entrée. Body : { id, label, rp: [{nom,email}] }
//  DELETE → supprime une entrée. Query : ?id=xxx
// ============================================================

const REDIS_URL    = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN   = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY     = 'campus-rp:data';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // enlève les accents
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
      return res.status(200).json(current);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { id, label, rp } = body || {};

      if (!label) return res.status(400).json({ error: 'Champ requis manquant : label' });
      if (!Array.isArray(rp) || rp.length === 0) {
        return res.status(400).json({ error: 'Au moins un RP requis (nom + email)' });
      }
      for (const p of rp) {
        if (!p.email || !p.email.includes('@')) {
          return res.status(400).json({ error: `Email invalide pour un RP : "${p.email || ''}"` });
        }
      }

      const finalId = (id && id.trim()) ? slugify(id) : slugify(label);
      const current = await redisGet(REDIS_KEY);
      const idx = current.campuses.findIndex(c => c.id === finalId);
      const entry = { id: finalId, label: String(label).trim(), rp };

      if (idx >= 0) current.campuses[idx] = entry;
      else current.campuses.push(entry);

      await redisSet(REDIS_KEY, current);
      return res.status(200).json({ saved: true, campus: entry, campuses: current.campuses });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'Paramètre requis manquant : id' });

      const current = await redisGet(REDIS_KEY);
      const before = current.campuses.length;
      current.campuses = current.campuses.filter(c => c.id !== id);

      if (current.campuses.length === before) {
        return res.status(404).json({ error: `Campus introuvable : ${id}` });
      }

      await redisSet(REDIS_KEY, current);
      return res.status(200).json({ deleted: true, campuses: current.campuses });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin campus-rp error:', err);
    return res.status(500).json({ error: 'Erreur serveur', message: err.message });
  }
}
