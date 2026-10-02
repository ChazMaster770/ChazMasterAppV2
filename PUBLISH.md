# Publish ChazMaster (go live on the internet)

ChazMaster is a Next.js + PostgreSQL app. To use it publicly you need:
1. Your code on GitHub
2. A host for the app (Vercel — free, easiest)
3. A host for the database (Neon — free Postgres)

Total time: ~15 minutes. No code changes needed.

## Option A: Vercel + Neon (recommended, free)

### Step 1 — Create the database (Neon, free)
1. Go to https://neon.tech and sign up
2. Create a new project called `chazmaster`
3. Copy the connection string — it looks like:
   `postgresql://user:password@ep-xyz.neon.tech/chazmaster?sslmode=require`

### Step 2 — Push this code to GitHub
1. Create a new repository on https://github.com (e.g. `chazmaster`)
2. In this project folder:
   ```bash
   git init
   git add .
   git commit -m "ChazMaster launch"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/chazmaster.git
   git push -u origin main
   ```

### Step 3 — Deploy the app (Vercel, free)
1. Go to https://vercel.com and sign up with GitHub
2. Click **Add New → Project** → import your `chazmaster` repo
3. Before clicking Deploy, open **Environment Variables** and add:
   - `DATABASE_URL` = your Neon connection string from Step 1
   - (optional) `POKEMONTCG_API_KEY` = free key from https://pokemontcg.io (faster card pictures)
4. Click **Deploy** — you get a public URL like `https://chazmaster.vercel.app`

### Step 4 — Create the tables in your live database
From your own computer (with the repo cloned):
```bash
npm install
DATABASE_URL="paste-your-neon-connection-string" npx drizzle-kit push
```
Type `y` / confirm when asked. This creates `cards`, `sale_requests`, `request_items`, `upload_batches`.

### Step 5 — Use it
- Open your Vercel URL → **Upload CSV** → drop your CardUploader export
- Go to **My Collection → 🖼️ Get Pictures** to fetch card images
- Share `YOUR-URL/shop` with friends — they multi-select and send requests
- Review everything in **Requests**

## Option B: Everything on Railway (app + DB in one place)
1. Sign up at https://railway.app
2. **New Project → Deploy from GitHub** (select your repo)
3. **New → Database → PostgreSQL** (in the same project)
4. Railway auto-sets `DATABASE_URL` — redeploy the app service
5. After deploy: open the service → **Settings → Networking → Generate Domain** for a public URL
6. Run `npx drizzle-kit push` once against Railway's `DATABASE_URL` (same as Step 4 above)

## Option C: Render (free tier)
1. Create **PostgreSQL** on https://render.com → copy the **External Database URL**
2. Create **Web Service** from your GitHub repo:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
   - Env var: `DATABASE_URL` = External Database URL
3. Deploy, then run `npx drizzle-kit push` once against that URL.

## After publishing checklist
- [ ] Open `/api/health` — should return `{"ok":true}`
- [ ] Upload your real CSV
- [ ] Click **Get Pictures** in Collection
- [ ] Copy your `/shop` link and test a request from your phone
- [ ] (Optional) Add a custom domain in Vercel → Settings → Domains

## Notes
- Card pictures come from the free Pokémon TCG API (pokemontcg.io). Without an API key you get ~20 requests/min — the "Get Pictures" button handles that automatically by working in small batches. A free key raises limits a lot.
- Your 100k-card CSV uploads work fine — large uploads switch to fast bulk-insert mode automatically.
- Never commit your real `DATABASE_URL` to GitHub — always use environment variables.
