OSAKEVAHTI WORKER DEPLOY

Upload/replace only these files in the repository:

1) .github/workflows/worker-deploy.yml
   - NEW FILE

2) worker/wrangler.toml
   - REPLACE EXISTING FILE

Do not change worker/worker.js.

GitHub repository secrets must already exist:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID

The existing Cloudflare Worker secret FINNHUB_API_KEY stays in Cloudflare.
It is not stored in GitHub.

After commit:
GitHub -> Actions -> Deploy Cloudflare Worker
A successful run should be green.
