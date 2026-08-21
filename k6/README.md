# k6 load tests

Measure concurrent load on the Tombola API — public reads, **login**, and **ticket purchase**.

Install k6: https://k6.io/docs/get-started/installation/

## Before you run

1. Start the API locally (`npm run dev --prefix backend`).
2. For member tests, set credentials (see below).
3. Prefer **localhost** for heavy tests. Production has rate limits and Render/Neon caps.

## Scripts

### Public (no auth)

| Script | Purpose |
|--------|---------|
| `smoke.js` | One iteration, sanity check |
| `public-read.js` | Concurrent reads: health, event, payments, results |
| `concurrency-ramp.js` | Ramp VUs until latency or errors rise |

### Member (login + buy)

| Script | Purpose |
|--------|---------|
| `member-login.js` | Login + `/api/auth/me` loop |
| `member-flow.js` | Login → reserve 1 ticket → view order → **cancel** (frees inventory) |

### Production (`https://api.rotaractiugb.com`)

| Script | Purpose |
|--------|---------|
| `prod-smoke.js` | Public sanity check |
| `prod-public-read.js` | 10 concurrent public reads |
| `prod-ramp.js` | Ramp 5 → 30 public reads |
| `prod-member-login.js` | Login + `/api/auth/me` on prod |
| `prod-member-flow.js` | Login → buy → cancel on prod (real test account) |

Production scripts require `CONFIRM=yes` (npm `load:prod:*` scripts set this).

## Test account (required for member flows)

Create a member on local or prod, then set credentials.

**Command Prompt (cmd)** — use this if your prompt is `C:\...>`:

```cmd
set K6_TEST_EMAIL=test@gmail.com
set K6_TEST_PASSWORD=admin123
npm run load:member
```

**PowerShell** — use this if your prompt ends with `PS C:\...>`:

```powershell
$env:K6_TEST_EMAIL="test@gmail.com"
$env:K6_TEST_PASSWORD="admin123"
npm run load:member
```

Do **not** paste comments after commands (e.g. `# login only` gets passed to k6 and breaks the run).

Run each npm command on its own line:

```cmd
npm run load:member
```

**Multiple users** (one account per VU — recommended for buy tests):

```powershell
$env:K6_TEST_EMAIL_TEMPLATE="loadtest+{vu}@yourdomain.com"
$env:K6_TEST_PASSWORD="SamePassword1!"
```

Create `loadtest+1@…`, `loadtest+2@…`, etc. in the app first (up to your VU count).

**Local only — auto-register** (max 8 VUs, hits register rate limit quickly):

```powershell
node scripts/k6-run.mjs member-flow.js -e K6_AUTO_REGISTER=yes -e VUS=5 -e DURATION=30s
```

## Examples

Public — 25 concurrent users:

```bash
npm run load:public
```

Member — login + buy + cancel:

```powershell
$env:K6_TEST_EMAIL="test@example.com"
$env:K6_TEST_PASSWORD="TestPass123!"
npm run load:member
```

Member — login only:

```powershell
npm run load:member:login
```

Production member flow (use a **dedicated test account**, not a real member):

```powershell
$env:K6_TEST_EMAIL="loadtest@yourdomain.com"
$env:K6_TEST_PASSWORD="..."
npm run load:prod:member
```

## Rate limits (important)

All VUs share **your IP**. The API limits:

| Action | Limit |
|--------|-------|
| Login | 15 / 15 min per IP |
| Register | 8 / 15 min per IP |
| Buy ticket | 20 / 15 min per IP |
| Cancel order | 10 / 15 min per IP |

Keep **VUS ≤ 5–10** for member buy tests from one machine. Use `K6_TEST_EMAIL_TEMPLATE` with several pre-created accounts for fairer results.

Member flows **cancel** reservations after each buy so ticket inventory is not consumed.

### Stuck on login timeouts or 429?

Failed runs retry login every iteration and quickly hit the **15 logins / 15 min** limit.

1. **Restart the backend** (clears in-memory rate limits), or run:

```cmd
npm run db:clear-rate-limits --prefix backend
```

Then restart: `npm run dev --prefix backend`

2. Use **one VU** with a single account:

```cmd
node scripts/k6-run.mjs member-flow.js -e VUS=1 -e DURATION=30s
```

3. Confirm the account exists locally (`test@gmail.com` must be registered in the app).

4. Make sure the backend is running: `npm run dev --prefix backend`

### Login times out but health works?

The API process is up but **database connections are stuck** (common after heavy load tests).

1. Stop the backend terminal (Ctrl+C)
2. Start it again: `npm run dev --prefix backend`
3. Wait until you see `Tombola API + WebSocket on port 3001`
4. Retry with 1 VU:

```cmd
node scripts/k6-run.mjs member-flow.js -e K6_AUTO_REGISTER=yes -e VUS=1 -e DURATION=30s
```

## Env vars

| Variable | Default | Used by |
|----------|---------|---------|
| `BASE_URL` | `http://localhost:3001` | local scripts |
| `K6_TEST_EMAIL` | — | member scripts |
| `K6_TEST_PASSWORD` | — | member scripts |
| `K6_TEST_EMAIL_TEMPLATE` | — | `{vu}` → per-VU email |
| `K6_AUTO_REGISTER` | — | `yes` = register in `member-flow.js` (local) |
| `VUS` | varies | all scenarios |
| `DURATION` | varies | all scenarios |
| `QUANTITY` | `1` | buy flows |
| `SLEEP` | `2` (buy) / `0.5` (login) | pause between iterations |
| `CONFIRM` | — | must be `yes` for prod scripts |

## Reading results

- **vus_max** — peak concurrent users
- **http_req_failed** — errors (429 = rate limited)
- **http_req_duration p(95)** — tail latency

When failures or 429s climb, you hit rate limits or server capacity.
