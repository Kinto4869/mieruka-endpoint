import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const token = process.env.API_TOKEN;
if (!token) throw new Error('Set API_TOKEN before starting the receiver.');
const dir = process.env.DATA_DIR || './data';
mkdirSync(dir, {recursive:true});
const db = new DatabaseSync(join(dir, 'measurements.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS readings (
    adaptateur_id TEXT NOT NULL, horodatage TEXT NOT NULL, watts REAL NOT NULL, source TEXT NOT NULL,
    PRIMARY KEY (adaptateur_id, horodatage)
  )`);
const insert = db.prepare('INSERT INTO readings VALUES (?,?,?,?) ON CONFLICT DO NOTHING');
const latest = db.prepare(`SELECT * FROM readings AS r WHERE horodatage =
  (SELECT MAX(horodatage) FROM readings WHERE adaptateur_id=r.adaptateur_id) ORDER BY adaptateur_id`);

function failure(status, message) {
  return Object.assign(new Error(message), {status});
}

async function readBatch(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw failure(415,'Expected application/json');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 65536) throw failure(413,'Body exceeds 64 KiB');
    chunks.push(chunk);
  }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw failure(400,'Invalid JSON'); }
  const batch = Array.isArray(parsed) ? parsed : [parsed];
  if (!batch.length || batch.length > 100) throw failure(400,'Expected 1–100 readings');
  return batch.map(row => {
    if (typeof row?.adaptateur_id !== 'string' || !/^NABD-\d{4}$/.test(row.adaptateur_id) ||
        !Number.isFinite(row.watts) || row.watts < 0 || !['simulee','reelle'].includes(row.source) ||
        typeof row.horodatage !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(row.horodatage) ||
        !Number.isFinite(Date.parse(row.horodatage))) throw failure(400,'Invalid reading fields');
    return [row.adaptateur_id,new Date(row.horodatage).toISOString(),row.watts,row.source];
  });
}

createServer(async (req,res) => {
  function send(status, body) {
    res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(body));
  }
  try {
    if (req.url === '/health' && req.method === 'GET') return send(200,{ok:true});
    if (req.headers.authorization !== 'Bearer '+token) return send(401,{error:'Bearer token required'});
    if (req.url === '/readings' && req.method === 'GET') return send(200,latest.all());
    if (req.url !== '/mesures' || req.method !== 'POST') return send(404,{error:'Unknown endpoint'});
    const rows = await readBatch(req);
    db.exec('BEGIN');
    try {
      for (const row of rows) insert.run(...row);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    send(200,{acquittees:rows.length});
  } catch (error) {
    send(error.status ?? 500,{error:error.status ? error.message : 'Storage error'});
  }
}).listen(Number(process.env.PORT ?? 8788),'0.0.0.0');
