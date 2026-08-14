# Corridor Lights Setup

Verified 2026-08-13 PT.

## Local Project

- Project root: `/Users/aileansolutions/beautiful-demons`
- Cloudflare Pages project name: `corridorlights-net`
- Production branch: `main`
- Static asset directory: `/Users/aileansolutions/beautiful-demons/public`
- Current local git history starts with `Initialize Corridor Lights web project` on branch `main`.

## Commands

```bash
cd /Users/aileansolutions/beautiful-demons
npm run deploy
```

`npm run deploy` uses the existing verified Wrangler binary from `/Users/aileansolutions/meetings-maestro/node_modules/.bin/wrangler` because `npx wrangler` hit an npm cache error on this machine during setup.

## Cloudflare

Cloudflare Pages direct upload is working.

- Pages project: `corridorlights-net`
- Production Pages URL: `https://corridorlights-net.pages.dev/`
- First deployment ID: `381384ce-3aa7-4aa2-bb0f-ffdf734bdb76`
- First deployment URL: `https://381384ce.corridorlights-net.pages.dev`
- Cloudflare zone: `corridorlights.net` (`e79457ade9ee1d608552166b4d355ff1`)
- Zone nameservers: `adam.ns.cloudflare.com`, `kay.ns.cloudflare.com`

Custom domains were added through the Cloudflare Pages API on 2026-08-13 and verified active with SSL enabled the same day:

- `https://corridorlights.net/`
- `https://www.corridorlights.net/`

DNS records in Cloudflare route both hostnames through the Pages project:

- `corridorlights.net` -> `corridorlights-net.pages.dev`
- `www.corridorlights.net` -> `corridorlights-net.pages.dev`

Verification on 2026-08-13 PT:

- `wrangler pages project list` showed `corridorlights.net` and `www.corridorlights.net` attached to `corridorlights-net`.
- HTTPS requests to both custom domains returned HTTP 200.

## Site Version Notes

- 2026-08-13: First archival site version built and deployed from commit `3074568`.
- Deployment preview URL: `https://6824378c.corridorlights-net.pages.dev`
- Live routes verified HTTP 200: `/`, `/about.html`, `/music.html`, `/documents.html`, `/photos.html`, `/notes.html`, `/contact.html`, `/style.css`.

## GitHub

GitHub SSH access works through the `github-workspace` host alias.

Repository:

- Owner: `AILean-ops`
- Repo: `beautiful-demons`
- Visibility: private
- Remote: `git@github-workspace:AILean-ops/beautiful-demons.git`
- Initial push completed on 2026-08-13 at commit `5f1bf36`.

Push future updates with:

```bash
cd /Users/aileansolutions/beautiful-demons
git push
```

Connect the repo in Cloudflare Dashboard -> Workers & Pages -> `corridorlights-net` -> Settings -> Builds & deployments -> Git repository.
