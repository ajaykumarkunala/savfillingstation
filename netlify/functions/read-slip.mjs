/ Only the two signed-in accounts may call it, so strangers cannot use up your API credit.
//
// Netlify environment variables:
//   ANTHROPIC_API_KEY  (required)  your Anthropic API key
//   ALLOWED_EMAILS     (optional)  comma-separated list; defaults to the two station accounts
//   CLAUDE_MODEL       (optional)  defaults to claude-sonnet-5-5

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCqdpvIH_zST-GOIVmq2bx-9XTBqX7j_JE';
const ALLOWED = (process.env.ALLOWED_EMAILS ||
  'kunalasspa@gmail.com,sriaadivaraahafillingstation@gmail.com')
  .toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

const reply = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

async function signedInEmail(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  const u = j.users && j.users[0];
  return u && u.email ? String(u.email).toLowerCase() : null;
}

const PROMPT =
  'This is a printed totalizer / meter-reading slip from a petrol pump dispenser (MPD). ' +
  'Find the cumulative totalizer VOLUME reading in litres for each nozzle (nozzle numbers 1 to 4). ' +
  'Do NOT use money / amount values, dates, times, serial numbers or test quantities. ' +
  'Copy the digits exactly as printed, including the decimal point; never guess an unreadable number (leave that nozzle out). ' +
  'Reply with ONLY a JSON object, no other text, in this shape: ' +
  '{"isSlip":true,"mpd":1,"nozzles":[{"nozzle":1,"product":"Diesel","volume":"12345.67"}],"notes":""} ' +
  'where product is "Petrol", "Diesel" or "Unknown", mpd is the dispenser number if printed (else null), ' +
  'and notes is a short remark about anything unclear (else empty string). ' +
  'If the image is not a dispenser slip, reply {"isSlip":false,"mpd":null,"nozzles":[],"notes":"short reason"}.';

export default async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  if (!process.env.ANTHROPIC_API_KEY) return reply(500, { error: 'The slip reader is not set up yet (missing API key).' });

  let email = null;
  try { email = await signedInEmail(req); } catch (e) { /* treated as not signed in */ }
  if (!email || !ALLOWED.includes(email)) return reply(401, { error: 'Please sign in again.' });

  let body;
  try { body = await req.json(); } catch (e) { return reply(400, { error: 'Bad request.' }); }
  const data = body && body.data, mediaType = body && body.mediaType;
  const okType = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!data || typeof data !== 'string' || !okType.includes(mediaType)) return reply(400, { error: 'Send a JPG, PNG or PDF.' });
  if (data.length > 7_000_000) return reply(413, { error: 'That file is too large.' });

  const block = mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data } };

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }] }),
    });
  } catch (e) { return reply(502, { error: 'Could not reach the reading service. Try again.' }); }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.error('Anthropic error', r.status, t.slice(0, 300));
    return reply(502, { error: r.status === 401 || r.status === 403 ? 'The API key was not accepted.' : r.status === 429 || r.status === 529 ? 'The reader is busy. Try again in a moment.' : 'The slip could not be read. Try again.' });
  }

  const j = await r.json().catch(() => ({}));
  const text = ((j.content || []).find((c) => c.type === 'text') || {}).text || '';
  const m = text.match(/\{[\s\S]*\}/);
  let out;
  try { out = JSON.parse(m ? m[0] : text); } catch (e) { return reply(502, { error: 'The slip could not be read. Try a sharper photo.' }); }

  const nozzles = (Array.isArray(out.nozzles) ? out.nozzles : [])
    .map((n) => ({
      nozzle: parseInt(n.nozzle, 10),
      product: ['Petrol', 'Diesel'].includes(n.product) ? n.product : 'Unknown',
      volume: String(n.volume == null ? '' : n.volume).replace(/[^0-9.]/g, ''),
    }))
    .filter((n) => n.nozzle >= 1 && n.nozzle <= 4 && n.volume !== '');
  return reply(200, {
    isSlip: out.isSlip !== false && nozzles.length > 0,
    mpd: Number.isInteger(out.mpd) ? out.mpd : null,
    nozzles,
    notes: typeof out.notes === 'string' ? out.notes.slice(0, 200) : '',
  });
};

export const config = { path: '/api/read-slip' };
