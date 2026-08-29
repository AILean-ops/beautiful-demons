#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const ZONE_ID = "e79457ade9ee1d608552166b4d355ff1";
const HOSTS = ["corridorlights.net", "www.corridorlights.net"];
const API_URL = "https://api.cloudflare.com/client/v4/graphql";
const AUDIO_PREFIX = "/assets/corridor-lights/audio/";
const DOWNLOAD_PREFIX = "/downloads/corridor-lights/audio/";
const ARCHIVE_PAGES = [
  "/",
  "/index.html",
  "/about.html",
  "/music.html",
  "/music",
  "/documents.html",
  "/documents",
  "/photos.html",
  "/photos",
  "/notes.html",
  "/notes",
  "/contact.html",
  "/contact",
  "/style.css",
];
const STATE_DIR = new URL("./state/", import.meta.url);
const BASELINE_FILE = new URL("./state/cloudflare-traffic-baseline.json", import.meta.url);
const LAST_RUN_FILE = new URL("./state/cloudflare-traffic-last-run.json", import.meta.url);

const TRACK_TITLES = new Map([
  ["we-were-the-fire.mp3", "We Were the Fire"],
  ["five-against-the-dark.mp3", "Five Against the Dark"],
  ["we-are-still-burning.mp3", "We Are Still Burning"],
  ["last-transmission.mp3", "Last Transmission"],
  ["paper-crowns-eli-acoustic-demo.mp3", "Paper Crowns - Eli Acoustic Demo"],
  ["we-run-this.mp3", "We Run This"],
  ["untitled-spankys-6-87.mp3", "Untitled (Spanky's 6/87)"],
]);

const args = new Set(process.argv.slice(2));
const hours = Number(valueAfter("--hours") || 24);
const writeBaseline = args.has("--write-baseline");
const writeLastRun = args.has("--write-last-run") || writeBaseline;
const quietNoSignal = args.has("--quiet-no-signal");

if (!Number.isFinite(hours) || hours <= 0) {
  fail("--hours must be a positive number.");
}

const until = new Date();
const since = new Date(until.getTime() - hours * 60 * 60 * 1000);

const token = await readWranglerToken();
const analytics = await fetchAnalytics(token, since, until);
const report = summarize(analytics, since, until);

if (writeBaseline) {
  await saveJson(BASELINE_FILE, {
    createdAt: new Date().toISOString(),
    window: { since: since.toISOString(), until: until.toISOString(), hours },
    summary: report.summary,
    audio: report.audio,
    downloads: report.downloads,
    pages: report.pages,
    countries: report.countries,
  });
}

if (writeLastRun) {
  await saveJson(LAST_RUN_FILE, {
    createdAt: new Date().toISOString(),
    window: { since: since.toISOString(), until: until.toISOString(), hours },
    summary: report.summary,
    audio: report.audio,
    downloads: report.downloads,
    pages: report.pages,
    countries: report.countries,
  });
}

const baseline = existsSync(filePath(BASELINE_FILE))
  ? JSON.parse(await readFile(BASELINE_FILE, "utf8"))
  : null;

const text = formatReport(report, baseline, { writeBaseline });
if (!(quietNoSignal && report.summary.humanSignalRequests === 0 && report.summary.audioRequests === 0)) {
  console.log(text);
}

function valueAfter(name) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1];
}

async function readWranglerToken() {
  const configPath = path.join(os.homedir(), "Library/Preferences/.wrangler/config/default.toml");
  const text = await readFile(configPath, "utf8");
  const match = text.match(/^oauth_token\s*=\s*"([^"]+)"/m);
  if (!match) fail(`Could not find oauth_token in ${configPath}`);
  return match[1];
}

async function fetchAnalytics(token, sinceDate, untilDate) {
  const query = `
    query CorridorLightsTraffic($zoneTag: string, $since: Time, $until: Time, $hosts: [string!], $archivePages: [string!]) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          hourly: httpRequests1hGroups(
            limit: 48
            filter: { datetime_geq: $since, datetime_lt: $until }
          ) {
            dimensions { datetime }
            sum { requests bytes cachedRequests }
            uniq { uniques }
          }
          audio: httpRequestsAdaptiveGroups(
            limit: 200
            filter: {
              datetime_geq: $since
              datetime_lt: $until
              clientRequestHTTPHost_in: $hosts
              clientRequestPath_like: "%/assets/corridor-lights/audio/%"
            }
          ) {
            dimensions { clientRequestPath edgeResponseStatus }
            count
            sum { edgeResponseBytes visits }
          }
          downloads: httpRequestsAdaptiveGroups(
            limit: 200
            filter: {
              datetime_geq: $since
              datetime_lt: $until
              clientRequestHTTPHost_in: $hosts
              clientRequestPath_like: "%/downloads/corridor-lights/audio/%"
            }
          ) {
            dimensions { clientRequestPath edgeResponseStatus }
            count
            sum { edgeResponseBytes visits }
          }
          paths: httpRequestsAdaptiveGroups(
            limit: 500
            filter: {
              datetime_geq: $since
              datetime_lt: $until
              clientRequestHTTPHost_in: $hosts
            }
          ) {
            dimensions { clientRequestPath edgeResponseStatus }
            count
            sum { edgeResponseBytes visits }
          }
          countries: httpRequestsAdaptiveGroups(
            limit: 50
            filter: {
              datetime_geq: $since
              datetime_lt: $until
              clientRequestHTTPHost_in: $hosts
              OR: [
                { clientRequestPath_like: "%/assets/corridor-lights/%" }
                { clientRequestPath_in: $archivePages }
              ]
            }
          ) {
            dimensions { clientCountryName }
            count
          }
        }
      }
    }
  `;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        zoneTag: ZONE_ID,
        since: sinceDate.toISOString(),
        until: untilDate.toISOString(),
        hosts: HOSTS,
        archivePages: ARCHIVE_PAGES,
      },
    }),
  });

  if (!response.ok) {
    fail(`Cloudflare analytics request failed: HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.errors?.length) {
    fail(`Cloudflare analytics error: ${body.errors.map((e) => e.message).join("; ")}`);
  }

  const zone = body.data?.viewer?.zones?.[0];
  if (!zone) fail("Cloudflare analytics returned no zone data.");
  return zone;
}

function summarize(data, sinceDate, untilDate) {
  const hourly = data.hourly ?? [];
  const totals = hourly.reduce((acc, row) => {
    acc.requests += row.sum.requests || 0;
    acc.bytes += row.sum.bytes || 0;
    acc.cachedRequests += row.sum.cachedRequests || 0;
    acc.uniques += row.uniq.uniques || 0;
    return acc;
  }, { requests: 0, bytes: 0, cachedRequests: 0, uniques: 0 });

  const audio = rollupByPath(data.audio ?? []);
  const downloads = rollupByPath(data.downloads ?? []);
  const pages = rollupByPath((data.paths ?? []).filter((row) => isArchivePage(row.dimensions.clientRequestPath)));
  const knownArchive = rollupByPath((data.paths ?? []).filter((row) => isKnownArchivePath(row.dimensions.clientRequestPath)));
  const probeCount = (data.paths ?? []).reduce((total, row) => {
    return total + (isLikelyProbe(row.dimensions.clientRequestPath) ? row.count : 0);
  }, 0);

  const audioRequests = audio.reduce((total, item) => total + item.requests, 0);
  const audioBytes = audio.reduce((total, item) => total + item.bytes, 0);
  const downloadRequests = downloads.reduce((total, item) => total + item.requests, 0);
  const pageRequests = pages.reduce((total, item) => total + item.requests, 0);
  const humanSignalRequests = knownArchive.reduce((total, item) => total + item.requests, 0);
  const humanSignalVisits = knownArchive.reduce((total, item) => total + item.visits, 0);

  return {
    window: { since: sinceDate.toISOString(), until: untilDate.toISOString(), hours },
    summary: {
      totalRequests: totals.requests,
      approximateHourlyUniques: totals.uniques,
      totalBytes: totals.bytes,
      cachedRequests: totals.cachedRequests,
      audioRequests,
      audioBytes,
      downloadRequests,
      pageRequests,
      humanSignalRequests,
      humanSignalVisits,
      likelyProbeRequests: probeCount,
    },
    audio,
    downloads,
    pages,
    countries: topRows(data.countries ?? [], "clientCountryName", 8),
  };
}

function rollupByPath(rows) {
  const byPath = new Map();
  for (const row of rows) {
    const rawPath = row.dimensions.clientRequestPath || "/";
    const label = labelForPath(rawPath);
    const status = Number(row.dimensions.edgeResponseStatus || 0);
    if (![200, 206, 301, 302, 307, 308].includes(status)) continue;
    const existing = byPath.get(label) ?? { label, paths: new Set(), requests: 0, bytes: 0, visits: 0, statuses: new Map() };
    existing.paths.add(rawPath);
    existing.requests += row.count || 0;
    existing.bytes += row.sum.edgeResponseBytes || 0;
    existing.visits += row.sum.visits || 0;
    existing.statuses.set(status, (existing.statuses.get(status) ?? 0) + (row.count || 0));
    byPath.set(label, existing);
  }
  return [...byPath.values()]
    .map((item) => ({
      ...item,
      paths: [...item.paths].sort(),
      statuses: Object.fromEntries(item.statuses),
    }))
    .sort((a, b) => b.requests - a.requests || b.bytes - a.bytes);
}

function topRows(rows, field, limit) {
  return rows
    .map((row) => ({
      name: row.dimensions[field] || "unknown",
      requests: row.count || 0,
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit);
}

function labelForPath(requestPath) {
  if (requestPath.startsWith(AUDIO_PREFIX)) {
    const file = requestPath.slice(AUDIO_PREFIX.length);
    return TRACK_TITLES.get(file) ?? file;
  }
  if (requestPath.startsWith(DOWNLOAD_PREFIX)) {
    const file = requestPath.slice(DOWNLOAD_PREFIX.length);
    return TRACK_TITLES.get(file) ?? file;
  }
  if (requestPath === "/") return "Home";
  const file = requestPath.replace(/^\//, "").replace(/\.html$/, "");
  return file || requestPath;
}

function isArchivePage(requestPath) {
  return ARCHIVE_PAGES.includes(requestPath);
}

function isKnownArchivePath(requestPath) {
  return isArchivePage(requestPath)
    || requestPath.startsWith("/assets/corridor-lights/")
    || requestPath.startsWith(DOWNLOAD_PREFIX);
}

function isLikelyProbe(requestPath) {
  return /(^|\/)(\.env|\.git|wp-|wp\/|wordpress|admin|login|api|actuator|server|config|vendor|php|cgi-bin|owa|solr|boaform|manager|laravel|backup)/i.test(requestPath);
}

function formatReport(report, baseline, options) {
  const lines = [];
  const localSince = fmtLocal(report.window.since);
  const localUntil = fmtLocal(report.window.until);
  lines.push(`Corridor Lights traffic ${options.writeBaseline ? "baseline" : "check"} (${localSince} to ${localUntil} PT)`);
  lines.push(`Most human-likely traffic: ${n(report.summary.humanSignalRequests)} content requests across ${n(report.summary.humanSignalVisits)} Cloudflare visit signals.`);
  lines.push(`- Pages/styles: ${n(report.summary.pageRequests)} requests`);
  lines.push(`- Audio: ${n(report.summary.audioRequests)} requests (${bytes(report.summary.audioBytes)})`);
  lines.push(`- Download clicks: ${n(report.summary.downloadRequests)} requests`);
  lines.push(`Total edge traffic: ${n(report.summary.totalRequests)} requests, including bots, scanners, caching, redirects, and asset loads. Whole-zone hourly uniques summed: ${n(report.summary.approximateHourlyUniques)}.`);
  if (report.summary.likelyProbeRequests) {
    lines.push(`Obvious scanner noise: about ${n(report.summary.likelyProbeRequests)} requests to non-game/probe paths.`);
  }

  if (baseline?.summary && !options.writeBaseline) {
    const deltaAudio = report.summary.audioRequests - (baseline.summary.audioRequests ?? 0);
    const deltaDownloads = report.summary.downloadRequests - (baseline.summary.downloadRequests ?? 0);
    const deltaSignal = report.summary.humanSignalRequests - (baseline.summary.humanSignalRequests ?? 0);
    const baselineVisits = baseline.summary.humanSignalVisits ?? 0;
    const deltaVisits = report.summary.humanSignalVisits - baselineVisits;
    lines.push(`Compared with the saved baseline: human-likely content requests ${signed(deltaSignal)}, visit signals ${signed(deltaVisits)}, audio requests ${signed(deltaAudio)}, download clicks ${signed(deltaDownloads)}.`);
  }

  if (report.audio.length) {
    lines.push("");
    lines.push("Top audio:");
    for (const item of report.audio.slice(0, 7)) {
      lines.push(`- ${item.label}: ${n(item.requests)} requests, ${bytes(item.bytes)}`);
    }
  } else {
    lines.push("");
    lines.push("Top audio: no MP3 requests in this window.");
  }

  if (report.downloads.length) {
    lines.push("");
    lines.push("Top downloads:");
    for (const item of report.downloads.slice(0, 7)) {
      lines.push(`- ${item.label}: ${n(item.requests)} clicks`);
    }
  } else {
    lines.push("");
    lines.push("Top downloads: no download-link requests in this window.");
  }

  if (report.pages.length) {
    lines.push("");
    lines.push("Top pages/assets:");
    for (const item of report.pages.slice(0, 7)) {
      lines.push(`- ${item.label}: ${n(item.requests)} requests`);
    }
  }

  if (report.countries.length) {
    lines.push("");
    lines.push(`Top countries: ${report.countries.map((item) => `${item.name} ${n(item.requests)}`).join(", ")}`);
  }

  lines.push("");
  lines.push("No site-side tracking code is involved; download clicks are counted from dedicated download URLs, while content requests and Cloudflare visit signals are directional, not exact people.");
  return lines.join("\n");
}

function fmtLocal(iso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function n(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function signed(value) {
  if (value === 0) return "flat";
  return `${value > 0 ? "+" : ""}${n(value)}`;
}

function bytes(value) {
  const units = ["B", "KB", "MB", "GB"];
  let size = value || 0;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

async function saveJson(url, data) {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(url, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function filePath(url) {
  return new URL(url).pathname;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
