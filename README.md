# Mieruka telemetry receiver

The simulator posts measurements to this standalone Node service. SQLite stores the history.

### Send a test reading to Railway

Set `API_TOKEN` in your terminal or simulator backend to the token configured for the Railway service. Send one JSON reading or a batch of 1–100 readings.

```sh
BASE_URL="https://mieruka-endpoint-production.up.railway.app"

curl -fsS "$BASE_URL/health"

curl -fsS "$BASE_URL/mesures" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"adaptateur_id\":\"NABD-0001\",\"horodatage\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"watts\":110.4,\"source\":\"simulee\"}"

curl -fsS "$BASE_URL/readings" \
  -H "Authorization: Bearer $API_TOKEN"
```

The health check returns `{"ok":true}`. The POST acknowledges the reading with `{"acquittees":1}`. The final GET returns the latest reading for each adapter.

### Local development

Use Node 22.13 or later. Start the receiver locally, then use `http://localhost:8788` as `BASE_URL` with your local token.

```sh
export API_TOKEN="$(openssl rand -hex 32)"
npm start
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
- `GET /readings` uses the same bearer token. It returns an array with the latest reading by measurement time for each adapter, sorted by adapter ID. An empty database returns `[]`. Consumers pull this data over HTTP. Automatic forwarding to Django is available when configured below.
- `GET /health` is public and returns `{"ok":true}`.

Use [openapi.json](openapi.json) as the machine-readable API contract when generating a client.

### Railway

Deploy this repository as one Dockerfile service. Set a strong secret in the API_TOKEN service variable, attach a volume mounted at /data and generate a public HTTPS domain. Configure /health as the health check. Give the simulator operator the domain and the token through a private channel. Use one replica for the SQLite volume. Railway supplies PORT. [Volumes](https://docs.railway.com/volumes) · [Public networking](https://docs.railway.com/networking/public-networking)

### Forward new readings to Django

Set `FORWARD_URL=https://kizuna-temp.vercel.app/api/mesures` in Railway. If the Vercel app has `MIERUKA_ADAPTER_KEY` configured, set that same secret in Railway. The receiver sends it as `X-Adapter-Key`. The simulator still uses Railway’s `API_TOKEN` to post to `/mesures`.

The Vercel intake accepts registered adapter IDs and power from 0 to 10,000 W. Test with a registered adapter such as `NABD-0001` and a current timestamp. The Railway acknowledgement confirms the local write. Check the Railway deploy logs for forwarding errors.

With forwarding enabled, Railway stores each new reading and queues it for Django in the same transaction. Acknowledgement to the simulator means the reading is stored on Railway. Delivery to Django retries with backoff until Django acknowledges the batch. Use a persistent Railway volume at `/data` to retain pending deliveries. Forwarding applies to readings first stored after configuration.
