# Club Tombola

Two apps, one API:

- **Tombola** (members): buy scratch tickets and reveal prizes after the draw
- **Espace organisateurs**: configure the tombola, mark payments, run the draw
- Linked live over **WebSocket** (`/ws`) so ticket counts, paid status, and scratch unlock update immediately

## Run locally

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm install --prefix organizer
npm run db:seed
npm run dev
```

- Tombola: http://localhost:5173
- Organizers: http://localhost:5174 (password from `ADMIN_PASSWORD` in `backend/.env`)

Default seed: 50 tickets at 1 000 F CFA, 5 prizes, sales open.

## Production

| App | Host | Production URL | Custom domain |
|---|---|---|---|
| Public tombola | Vercel (`rotaract-tombola`) | https://rotaract-tombola.vercel.app | https://tombola.rotaractiugb.com |
| Organizers | Vercel (`rotaract-organisateurs`) | https://rotaract-organisateurs.vercel.app | https://organisateurs.rotaractiugb.com |
| API + WebSocket | Render (`rotaract-tombola-api`) | `https://rotaract-tombola-api.onrender.com` | https://api.rotaractiugb.com |

The apex (`rotaractiugb.com` / `www`) is left for the club site and for email (`contact@rotaractiugb.com`). Do **not** change GoDaddy nameservers.

### Deploy the API on Render

1. Push this repo to GitHub (`Myahse/Tombola-rotaract`).
2. In [Render](https://dashboard.render.com): **New** → **Blueprint**, and select that repo (it reads `render.yaml`).
3. Paste the secret env vars when prompted (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`, Brevo keys). Use the Neon **pooled** connection string.
4. After the first deploy, add the custom domain `api.rotaractiugb.com` if the Blueprint did not attach it.

### DNS on GoDaddy

Keep nameservers `ns31.domaincontrol.com` / `ns32.domaincontrol.com`. Add:

| Type | Name | Value |
|---|---|---|
| A | `tombola` | `76.76.21.21` |
| A | `organisateurs` | `76.76.21.21` |
| CNAME | `api` | `rotaract-tombola-api.onrender.com` |

Do **not** point `api` at Vercel (`76.76.21.21`). That record is only for the two frontend apps.

Free Render instances spin down after idle time; the first request can take ~50s. Upgrade the service to Starter if the live draw must stay connected.

### API environment variables (Render)

- `DATABASE_URL` — Neon pooled connection
- `SESSION_SECRET`
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL` (optional)
- `CORS_ORIGIN` = `https://tombola.rotaractiugb.com,https://organisateurs.rotaractiugb.com`
- `PUBLIC_SITE_URL` = `https://tombola.rotaractiugb.com`
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`

Frontend production URLs are in `frontend/.env.production` and `organizer/.env.production` (they already call `https://api.rotaractiugb.com`).
