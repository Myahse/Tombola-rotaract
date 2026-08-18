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
