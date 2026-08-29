# Technical Reference

## Corridor Lights Site

- Local source: `/Users/aileansolutions/beautiful-demons`
- Public site files: `public/`
- Music page: `public/music.html`
- Documents page: `public/documents.html`
- Corridor Lights image assets: `public/assets/corridor-lights/`
- Audio assets: `public/assets/corridor-lights/audio/`
- Download links use dedicated Cloudflare-visible URLs under `/downloads/corridor-lights/audio/`, mapped to the MP3 assets by `public/_redirects`, so Cloudflare request analytics can count download-link clicks without site-side tracking code.
- Deploy command: `npm run deploy`
- Cloudflare zone: `corridorlights.net` (`e79457ade9ee1d608552166b4d355ff1`)
- Traffic reporter: `ops/cloudflare-traffic-report.mjs`
- Traffic report summary leads with human-likely content activity: known page/style/audio/download-link requests plus Cloudflare visit signals for those content paths. Whole-zone request totals and hourly uniques are shown separately because they include bots, scanners, redirects, cache behavior, and asset loads.
- Manual traffic command: `npm run traffic`
- Traffic reporter state: `ops/state/` (local only, gitignored)
- Traffic report delivery wrapper: `/Users/aileansolutions/.openclaw/workspace/scripts/corridor_lights_traffic_check.py`
- Traffic report LaunchAgent: `/Users/aileansolutions/Library/LaunchAgents/com.aileansolutions.corridor-lights-traffic-check.plist`, daily at 8:30 AM Pacific
- Traffic report Discord channel: `1538772589936381962`
- Proton Bridge inbox setup guide: `docs/PROTON-BRIDGE-INBOX.md`
- Proton Bridge env template: `ops/proton-bridge.env.example`
- Proton Bridge local secrets path: `ops/secrets/proton-bridge.env` (local only, gitignored)
- Proton inbox monitor: `ops/proton_inbox_monitor.py`
- Proton inbox baseline command: `npm run inbox:init`
- Proton inbox check command: `npm run inbox:check`
- Proton inbox Discord channel: `1538761072943566928`
- Proton inbox notification wrapper: `/Users/aileansolutions/.openclaw/workspace/scripts/corridor_lights_proton_inbox_check.py`
- Proton inbox LaunchAgent: `/Users/aileansolutions/Library/LaunchAgents/com.aileansolutions.corridor-lights-proton-inbox-check.plist`, every 30 minutes from 8:00 AM through 10:30 PM Pacific
- Proton inbox delivery note: the old OpenClaw cron `Corridor Lights Proton inbox monitor` (`3e7cb88b-8c2f-40c4-a758-a2188d63d8f3`) is disabled because its LLM subagent announce path could run the checker but drop Discord notifications.
- Proton inbox LaunchAgent verification 2026-08-16 PT: wrapper `py_compile` passed, installed plist lint passed, `launchctl kickstart` returned `last exit code = 0`, manual `NO_NEW_MAIL` run exited 0, and controlled re-drive of the dropped test UID posted Discord message `1538778201663475736`.

Verified locally on 2026-08-16.
