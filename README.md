# Club Tombola

Four apps, one API:

- **Tombola** (members): buy scratch tickets and reveal prizes after the draw
- **Espace organisateurs**: configure the tombola, mark payments, run the draw
- **Campagnes e-mail**: send custom emails (with images) to members, buyers, and extra addresses
- **Exams** (detached from the tombola):
  - **Exam** (`exams/exam`): candidates take the induction QCM
  - **Surveillance** (`exams/monitor`): open the session and watch candidates live
- Linked live over **WebSocket** (`/ws`) so ticket counts, paid status, scratch unlock, and QCM progress update immediately

## Run locally

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm install --prefix organizer
npm install --prefix campaign
npm install --prefix exams/monitor
npm install --prefix exams/exam
npm run db:seed
npm run dev
```

- Tombola: http://localhost:5173
- Organizers: http://localhost:5174 (password from `ADMIN_PASSWORD` in `backend/.env`)
- Email campaigns: http://localhost:5175 (same organizer login)
- Exam (candidates): http://localhost:5177 (member login)
- Monitoring: http://localhost:5176 (same organizer login)

Default seed: 50 tickets at 1 000 F CFA, 5 prizes, sales open.

## Production

| App | Host | Production URL | Custom domain |
|---|---|---|---|
| Public tombola | Vercel (`rotaract-tombola`) | https://rotaract-tombola.vercel.app | https://tombola.rotaractiugb.com |
| Organizers | Vercel (`rotaract-organisateurs`) | https://rotaract-organisateurs.vercel.app | https://organisateurs.rotaractiugb.com |
| Email campaigns | Vercel (`rotaract-campagnes`) | https://rotaract-campagnes.vercel.app | https://campagnes.rotaractiugb.com |
| Exam (candidates) | Vercel (`rotaract-examen`) | https://rotaract-examen.vercel.app | https://exam.rotaractiugb.com |
| Monitor | Vercel (`rotaract-surveillance`) | https://rotaract-surveillance.vercel.app | https://monitor.rotaractiugb.com |
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
| A | `campagnes` | `76.76.21.21` |
| A | `exam` | `76.76.21.21` |
| A | `monitor` | `76.76.21.21` |
| CNAME | `api` | `rotaract-tombola-api.onrender.com` |

Do **not** point `api` at Vercel (`76.76.21.21`). That record is only for the frontend apps.

Free Render instances spin down after idle time; the first request can take ~50s. Upgrade the service to Starter if the live draw must stay connected.
