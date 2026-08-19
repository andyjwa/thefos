# Deploy slowly — data + team logos

Two separate things ship to GitHub Pages: **JSON league data** and **PNG logos**.

> **Hosting on Vercel?** The app lives in `web/`, not the repo root. The committed
> root **`vercel.json`** tells Vercel to `npm ci` + `npm run build` inside `web/`
> (with `VITE_BASE_PATH=/`) and publish `web/dist` — without it Vercel serves the
> raw repo files and the site 404s. Keep the project's **Root Directory** setting
> empty (repo root) so `vercel.json` is picked up, and add **`VITE_FPL_PROXY_URL`**
> as a Vercel environment variable (Project → Settings → Environment Variables)
> so the Live tab works — same value as the GitHub secret in § 1b below.

---

## 1. League data (standings, fixtures, waivers)

The live site reads **`league-data/details.json`** (and other JSON next to it).

### Path A — automatic (recommended)

1. Put the current Draft league number in the committed **`league-id`** file (26/27 = **1577**). That file is the source of truth — not the GitHub secret.
2. Optional fallback: GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **`FPL_LEAGUE_ID`**. The name is case-sensitive. If you also have a **github-pages Environment** secret of the same name, **it overrides the repository secret**. A leftover **6802** there ingested a stranger's league after the 26/27 rollover; keep Environment and repository values in sync, or delete the Environment copy and rely on `league-id`.
3. Push any commit (or run the workflow).

On each build, GitHub runs **`ingest.py`** with the committed id, then builds the site.

**Scheduled builds are gated** (`web/scripts/waiver-refresh-gate.mjs`): the hourly cron only deploys during ~36h after each FPL `waivers_time`, during **05:26–05:45 UTC** daily, or (after a finished gameweek) from **2h after that GW’s deadline** until **3h before the next GW deadline** — so H2H `details.json` can update when a week ends, not only when waivers run. **Pushes to `main` and manual “Run workflow” always deploy.** If the live site looks a week behind, run the workflow or push after `python3 ingest.py` + `npm run publish-real-league`; open `deploy-check.json` on the site and confirm `details.json` reflects the latest finished GW.

You can also set **Repository variable** `FPL_LEAGUE_ID` (Settings → Variables) if you prefer — same name.

**⚠ Season rollover — update `league-id` every August.** FPL Draft issues a **new league id each season** and recycles old numbers, so last season's id starts resolving to a **stranger's league** on the API. `ingest.py` also compares the fetched managers' last names with the committed `web/public/league-data/details.json` and **fails the build** on a mismatch. When that happens, update `league-id` (and any `FPL_LEAGUE_ID` secrets, including the **github-pages** Environment) to the new number from `draft.premierleague.com/league/<ID>`. Genuinely switching leagues? Set `ALLOW_LEAGUE_ID_OVERRIDE=1` / `ALLOW_LEAGUE_IDENTITY_MISMATCH=1` for one run (or replace the committed league-data via Path B).

### Path B — commit files

```bash
python3 ingest.py YOUR_LEAGUE_ID
cd web && npm run publish-real-league
git add web/public/league-data/
git commit -m "League data" && git push
```

---

## 1b. Live tab — FPL CORS proxy (Cloudflare Worker)

GitHub Pages cannot call `fantasy.premierleague.com` from the browser (CORS). The **Live** tab needs a tiny **proxy**.

1. Deploy the worker once (free Cloudflare account):

   ```bash
   cd web/workers/fpl-proxy
   npx wrangler login
   npx wrangler deploy
   ```

2. Copy the URL Wrangler prints (e.g. `https://tclot-fpl-proxy.yourname.workers.dev`).

3. Add **`VITE_FPL_PROXY_URL`** (no trailing slash). Name must match **exactly**. Use one of:

   - **Settings → Secrets and variables → Actions** → **Secrets** → New repository secret  
   - Or **Variables** on that page (same name) — the workflow reads both.
   - If the build still shows the value empty: **Settings → Environments → `github-pages` → Environment secrets** → add **`VITE_FPL_PROXY_URL`** (the deploy job uses that environment).

4. **Re-run the deploy workflow** after saving (**Actions → Run workflow** or push a commit).  
   Existing site JS **does not** update until a new build runs — `VITE_*` is baked in at build time.

5. Check **`https://YOUR_USER.github.io/YOUR_REPO/deploy-check.json`**: **`liveProxyConfigured`** should be **`true`**.  
   On **FPL Live**, you should **not** see the red banner **“No proxy in this JavaScript build.”** — if it appears, `VITE_FPL_PROXY_URL` was missing at build time.

### CI gate (won’t silently ship a broken Live tab)

On **every** push to `main` / scheduled deploy, **`deploy-github-pages.yml` fails early** unless `VITE_FPL_PROXY_URL` is configured (repository secret or variable, same as above). That stops a Pages build where the bundle would otherwise call `https://fantasy.premierleague.com/api` directly and break with CORS/HTML instead of JSON.

**Demo/fork repos** without a Worker can opt out by setting repository Variable **`FPL_PROXY_OPTIONAL`** to **`true`** (the workflow then skips this check).

Optional: in `web/workers/fpl-proxy/wrangler.toml`, set `[vars] ALLOW_ORIGIN = "https://YOUR_USER.github.io"` to restrict CORS.

---

## 2. Team logos (PNG)

Logos are **not** fetched from FPL. They only exist if **you** put files in the repo.

1. Put images in **`web/public/team-logos/`**
2. Name them **`{id}.png`** where `id` is each team’s **`league_entries[].id`** from `details.json`
3. Commit and push:

```bash
git add web/public/team-logos/
git commit -m "Logos" && git push
```

The build generates **`team-logos-web/`** from those PNGs. No PNGs in git → site shows letter bubbles only.

---

## 3. Check what actually deployed

After a successful deploy, open (replace with your site):

**`https://YOUR_USER.github.io/YOUR_REPO/deploy-check.json`**

You’ll see something like:

```json
{
  "leagueName": "...",
  "teamCount": 8,
  "isDemoData": false,
  "teamLogosPngInDist": 0,
  ...
}
```

- **`isDemoData: true`** → data path A or B above isn’t wired yet  
- **`teamLogosPngInDist: 0`** → no PNGs were in the repo at build time  

In **Actions → latest run → build job log**, look for:

- `Ingest: league ID is configured` vs `No FPL_LEAGUE_ID`
- `Team logo PNGs in build: N`

---

## 4. Common mistakes

| Symptom | Cause |
|--------|--------|
| **Only README / Markdown, not the dashboard** | **Pages → Build and deployment** is set to **Deploy from a branch**. Switch **Source** to **GitHub Actions** so the workflow’s `dist/` upload is what gets published. |
| **Totally blank / white page** | Wrong URL or **missing trailing slash**. Use **Settings → Pages** “Visit site” link. Must look like `https://USER.github.io/REPO/` (**slash at the end**). |
| Demo league / yellow banner | No `FPL_LEAGUE_ID` and no real committed `league-data` |
| Wrong league | Wrong ID in secret |
| Letter avatars only | `team-logos/*.png` not committed |
