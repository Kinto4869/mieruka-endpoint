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

### Wire format

| Field | Type | Meaning |
|---|---|---|
| `adaptateur_id` | string | `NABD-` followed by exactly four digits, such as `NABD-0003`. |
| `horodatage` | string | Measurement time in ISO 8601 with a timezone, such as `2026-11-22T13:00:00+01:00`. Reads return UTC with milliseconds. |
| `watts` | number | Instantaneous power in watts. Use a finite nonnegative JSON number, including decimals. |
| `source` | string | `simulee` for the simulator or `reelle` for real measurements. |

Use these exact French field names and values. The receiver stores and returns these four fields. Extra input fields such as `country`, latitude, longitude, and altitude are ignored.

- `POST /mesures` returns HTTP 200 and `{"acquittees":1}` for a single accepted reading. The count includes duplicates. After a timeout, retry the exact same reading or batch. An adapter ID and UTC-normalized timestamp identify one reading. The first value wins. Invalid batches return HTTP 400 before any rows are written.
- `GET /readings` uses the same bearer token. It returns an array with the latest reading by measurement time for each adapter, sorted by adapter ID. An empty database returns `[]`. Consumers pull this data over HTTP. The service has no automatic forwarding, webhook, or live stream.
- `GET /health` is public and returns `{"ok":true}`.

Use [openapi.json](openapi.json) as the machine-readable API contract when generating a client.

### Railway

Deploy this repository as one Dockerfile service. Set a strong secret in the API_TOKEN service variable, attach a volume mounted at /data and generate a public HTTPS domain. Configure /health as the health check. Give the simulator operator the domain and the token through a private channel. Use one replica for the SQLite volume. Railway supplies PORT. [Volumes](https://docs.railway.com/volumes) · [Public networking](https://docs.railway.com/networking/public-networking)
