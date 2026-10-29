# Free hosting: GitHub + Cloudflare Pages

Cost: USD 0. GitHub stores the code and runs the scheduled jobs; Cloudflare Pages serves the website over HTTPS.
API keys live in GitHub Secrets and never reach the website.

## How it runs
| Job | When (SGT) | What it does |
|---|---|---|
| Update dashboard | 06:30, 12:30, 18:30 daily, and after any change | Runs tests, fetches all data server-side, builds the site, publishes it to Cloudflare |
| Prepare briefing draft | 07:00 Mon–Fri (daily), 08:00 Sat (weekly), or on demand | Builds a draft from the data and opens a pull request for review |
| Briefing check | Whenever a draft is edited | Flags numbers not found in the data and any recommendation/certainty language |
| Publish approved briefing | When a reviewer merges the pull request | Records approver + time + PR link, republishes the site |

GitHub may start scheduled jobs a few minutes late at busy times.

## One-time setup (about 20 minutes)

### 1. Repository
1. In GitHub: **New repository** → name `ipcg-global-markets` → **Private** → Create (no README).
2. On the empty repo page click **uploading an existing file**. Unzip the package and drag in **everything inside** the `ipcg-global-markets` folder, including the hidden `.github` folder (on Mac press **Cmd + Shift + .** in Finder to show hidden folders). Click **Commit changes**.
   - If `.github` will not upload: **Add file → Create new file**, type `.github/workflows/update.yml` as the name, paste the file's contents, commit; repeat for the other three workflow files.

### 2. Cloudflare
1. Sign up free at https://dash.cloudflare.com/sign-up.
2. **Account ID:** Dashboard home → your account → copy *Account ID* (right-hand column on the Workers & Pages overview).
3. **API token:** profile icon → **My Profile → API Tokens → Create Token → Create Custom Token**. Permission: *Account · Cloudflare Pages · Edit*. Create, then copy the token (shown once).

### 3. Secrets and settings in GitHub (repo → Settings)
- **Secrets and variables → Actions → Secrets → New repository secret**
  - `FRED_API_KEY`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - later, optional: `EODHD_API_KEY`, `ANTHROPIC_API_KEY`
- **Variables tab** (optional): `CF_PAGES_PROJECT` = `ipcg-markets`; `PUBLIC_URL` = the site address once known; `APPROVER_NAMES` = `{"your-github-username": "Your Name"}` so the site shows names instead of usernames; `ANTHROPIC_MODEL`.
- **Actions → General → Workflow permissions:** choose **Read and write permissions** and tick **Allow GitHub Actions to create and approve pull requests**. Save.

### 4. First run
1. **Actions** tab → enable workflows if asked → **Update dashboard** → **Run workflow**. Takes 2–3 minutes.
2. The log's last step prints the address, normally `https://ipcg-markets.pages.dev` (Cloudflare adds a suffix if the name is taken). Set it as the `PUBLIC_URL` variable and run the job once more so WhatsApp previews use it.
3. **Actions → Prepare briefing draft → Run workflow** to try the review flow: open the pull request, edit `briefings/drafts/daily.md` if needed, wait for the green check, **Merge**. The site updates within a few minutes with "Reviewed by IPCG".

### 5. Optional
- Own domain: Cloudflare → Workers & Pages → the project → **Custom domains**.
- Limit who can approve: Settings → Branches → add a rule for `main` requiring a pull-request review from named people.

## Limits (free plans, checked Oct 2026)
- Cloudflare Pages free: unlimited visitors and bandwidth for static files, 500 deployments per month (this uses ~100).
- GitHub Free, private repositories: about 2,000 Actions minutes per month (this uses ~150–250).

## If you are on GitHub Enterprise Server (a company-hosted GitHub)
The same files work, but your IT team must have GitHub Actions enabled with a runner that can reach the internet (Treasury, FRED, central-bank sites, Cloudflare and npm). Change `runs-on: ubuntu-latest` in the four workflow files to the runner label IT gives you.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Publish step: "Authentication error" | Token needs *Cloudflare Pages · Edit*; check `CLOUDFLARE_ACCOUNT_ID`. |
| Draft job: "GitHub Actions is not permitted to create pull requests" | Step 3, Workflow permissions. |
| Site shows "Data temporarily unavailable" for FX/oil | `FRED_API_KEY` secret missing or mistyped. |
| Briefing check red | Read the job summary; correct or source the flagged number, or remove advice-like wording. |
| Briefing disappeared | Daily briefings older than 4 days (weekly: 9 days) are hidden on purpose. |
