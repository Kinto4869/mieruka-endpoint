# Mieruka telemetry receiver

The simulator posts measurements to this standalone Node service. SQLite stores the history. Start it locally with Node 22.13 or later.

```sh
export API_TOKEN="$(openssl rand -hex 32)"
npm start
```

### Simulator integration

Send one reading or an array of 1–100 readings with the same headers. Keep the token in the simulator backend environment. Replace the sample timestamp with the measurement time.

```sh
curl -i "${BASE_URL:-http://localhost:8788}/mesures" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"adaptateur_id":"NABD-0003","horodatage":"2026-11-22T12:00:00Z","watts":110.4,"source":"simulee"}'
```

HTTP 200 and `{"acquittees":1}` acknowledge durable storage. Retry the same payload after a timeout. A repeated adapter ID and timestamp keeps the first reading and is acknowledged again. Invalid batches return HTTP 400 atomically. IDs use NABD plus a hyphen and four digits. Watts must be finite and nonnegative. Supply an ISO timestamp with a timezone and source `simulee` or `reelle`.

Authenticated `GET /readings` returns the latest sample for each adapter. Public `GET /health` returns service status.

### Railway

Deploy this repository as one Dockerfile service. Set a strong secret in the API_TOKEN service variable, attach a volume mounted at /data and generate a public HTTPS domain. Configure /health as the health check. Give the simulator operator the domain and the token through a private channel. Use one replica for the SQLite volume. Railway supplies PORT. [Volumes](https://docs.railway.com/volumes) · [Public networking](https://docs.railway.com/networking/public-networking)
