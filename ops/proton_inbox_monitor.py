#!/usr/bin/env python3

import argparse
import email
import imaplib
import json
import os
import re
import socket
import ssl
from email.header import decode_header
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / "ops" / "secrets" / "proton-bridge.env"
STATE_PATH = ROOT / "ops" / "state" / "proton-inbox-state.json"


def main():
    parser = argparse.ArgumentParser(description="Monitor the game Proton inbox through Proton Mail Bridge.")
    parser.add_argument("--init", action="store_true", help="Record current inbox UIDs without reporting them.")
    parser.add_argument("--limit", type=int, default=10, help="Maximum new messages to report.")
    args = parser.parse_args()

    config = read_env(ENV_PATH)
    client = connect_imap(config)

    try:
        client.login(config["PROTON_BRIDGE_USERNAME"], config["PROTON_BRIDGE_PASSWORD"])
        client.select("INBOX", readonly=True)
        uids = search_uids(client)
        state = read_state()

        if args.init:
            state["seen_uids"] = sorted(set(state.get("seen_uids", [])) | set(uids), key=int)
            write_state(state)
            print(f"Initialized Proton inbox monitor with {len(uids)} current inbox messages recorded.")
            return

        seen = set(state.get("seen_uids", []))
        new_uids = [uid for uid in uids if uid not in seen]
        if not new_uids:
            print("NO_NEW_MAIL")
            return

        summaries = [fetch_summary(client, uid) for uid in new_uids[-args.limit:]]
        state["seen_uids"] = sorted(set(uids), key=int)
        write_state(state)

        print("NEW_PROTON_MAIL")
        for item in summaries:
            print(f"- From: {item['from']}")
            print(f"  Subject: {item['subject']}")
            print(f"  Date: {item['date']}")
            if item["preview"]:
                print(f"  Preview: {item['preview']}")
    finally:
        try:
            client.logout()
        except Exception:
            pass


def read_env(path):
    values = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        values[key.strip()] = value

    required = [
        "PROTON_BRIDGE_IMAP_HOST",
        "PROTON_BRIDGE_IMAP_PORT",
        "PROTON_BRIDGE_USERNAME",
        "PROTON_BRIDGE_PASSWORD",
        "PROTON_BRIDGE_FROM_EMAIL",
    ]
    missing = [key for key in required if not values.get(key)]
    if missing:
        raise SystemExit(f"Missing required Proton Bridge settings: {', '.join(missing)}")
    return values


def connect_imap(config):
    host = config["PROTON_BRIDGE_IMAP_HOST"]
    port = int(config["PROTON_BRIDGE_IMAP_PORT"])
    security = config.get("PROTON_BRIDGE_IMAP_SECURITY", "").lower()
    context = ssl._create_unverified_context()

    socket.setdefaulttimeout(10)
    if security in {"ssl", "tls", "imap_ssl"}:
        return imaplib.IMAP4_SSL(host, port, ssl_context=context)

    client = imaplib.IMAP4(host, port)
    if security in {"starttls", "start_tls", "tls-starttls"}:
        client.starttls(ssl_context=context)
    return client


def search_uids(client):
    status, data = client.uid("SEARCH", None, "ALL")
    if status != "OK":
        raise RuntimeError(f"IMAP search failed: {status}")
    return [uid.decode("ascii") for uid in data[0].split()] if data and data[0] else []


def fetch_summary(client, uid):
    status, data = client.uid("FETCH", uid, "(BODY.PEEK[])")
    if status != "OK" or not data:
        return {"from": "unknown", "subject": "unknown", "date": "unknown", "preview": ""}

    raw = next((part[1] for part in data if isinstance(part, tuple)), b"")
    message = email.message_from_bytes(raw)
    return {
        "from": decode_mime(message.get("From", "unknown")),
        "subject": decode_mime(message.get("Subject", "(no subject)")),
        "date": decode_mime(message.get("Date", "unknown")),
        "preview": preview_text(message),
    }


def decode_mime(value):
    parts = []
    for payload, charset in decode_header(value):
        if isinstance(payload, bytes):
            parts.append(payload.decode(charset or "utf-8", errors="replace"))
        else:
            parts.append(payload)
    return " ".join("".join(parts).split())


def preview_text(message):
    text = ""
    if message.is_multipart():
        for part in message.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition", "")).lower():
                payload = part.get_payload(decode=True)
                if payload:
                    text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                    break
    elif message.get_content_type() == "text/plain":
        payload = message.get_payload(decode=True)
        if payload:
            text = payload.decode(message.get_content_charset() or "utf-8", errors="replace")

    text = re.sub(r"\s+", " ", text).strip()
    return text[:280]


def read_state():
    if not STATE_PATH.exists():
        return {"seen_uids": []}
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def write_state(state):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    os.chmod(STATE_PATH, 0o600)


if __name__ == "__main__":
    main()
