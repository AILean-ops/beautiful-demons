# Proton Bridge Inbox Setup

Purpose: allow Sauron to monitor the Corridor Lights / Beautiful Demons Proton Mail inbox through Proton Mail Bridge without sharing the Proton account password in chat.

Verified source docs on 2026-08-16:

- Proton Mail Bridge overview: `https://proton.me/mail/bridge`
- IMAP/SMTP setup: `https://proton.me/support/imap-smtp-and-pop3-setup`
- Bridge client setup note: `https://proton.me/support/protonmail-bridge-clients-macos-new-outlook`

## Security Rules

- Do not paste the Proton account password into Discord, files, memory, or prompts.
- Use the Bridge-generated mailbox password, not the Proton login password.
- Keep Bridge credentials in a local gitignored secrets file or macOS Keychain.
- Sauron may monitor and draft once configured.
- Sauron may not send mail until Brian defines and approves a send policy.
- Account security changes remain Brian-only: password, recovery, 2FA, billing, aliases, and account deletion.

## Brian Setup Steps

1. Install Proton Mail Bridge on the Mac mini from Proton's official Bridge page.
2. Open Proton Mail Bridge.
3. Sign in to the game Proton Mail account inside Bridge.
4. Complete any Proton 2FA or device approval prompts.
5. In Bridge, open the account's mailbox details or email client configuration panel.
6. Copy the Bridge-generated local IMAP and SMTP settings:
   - IMAP host, usually `127.0.0.1`
   - IMAP port
   - SMTP host, usually `127.0.0.1`
   - SMTP port
   - Bridge username
   - Bridge password
   - Email address / from address
7. Put those values into a local secrets file based on `ops/proton-bridge.env.example`.
8. Tell Sauron that Bridge is running and the local secrets file is ready.

## Local Secrets File

Recommended path:

```bash
/Users/aileansolutions/beautiful-demons/ops/secrets/proton-bridge.env
```

Required permissions:

```bash
chmod 600 /Users/aileansolutions/beautiful-demons/ops/secrets/proton-bridge.env
```

This file is gitignored.

## Operating Policy Draft

Initial default:

- Monitor incoming mail every 30 minutes from 8:00 AM through 10:59 PM Pacific.
- Post summaries in the Beautiful Demons game email communications channel.
- Draft replies for Brian to review.
- Do not send replies automatically.

Future send envelope can allow low-risk replies when Brian approves a written policy covering:

- Account voice
- In-world vs out-of-world boundaries
- What questions Sauron can answer directly
- What canon changes require approval
- What messages must always escalate
- Audit trail format

## Current Automation

- Inbox monitor script: `ops/proton_inbox_monitor.py`
- Initialize baseline: `npm run inbox:init`
- Manual check: `npm run inbox:check`
- Local state: `ops/state/proton-inbox-state.json`
- OpenClaw cron job: `Corridor Lights Proton inbox monitor`
- OpenClaw cron ID: `3e7cb88b-8c2f-40c4-a758-a2188d63d8f3`
- Schedule: every 30 minutes, 8:00 AM-10:59 PM Pacific
- Discord report channel: `1538761072943566928`
- Behavior: stay silent when there is no new mail; send a Discord summary only when new mail arrives.
