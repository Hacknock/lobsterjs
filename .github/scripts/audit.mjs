import { spawnSync } from "node:child_process";

const allowedAdvisories = new Map([
  [
    "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
    "picomatch ReDoS via attacker-supplied globs; only reached through vite and vitest with globs from our own config, and no patched release exists yet",
  ],
]);

const audit = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
if (audit.error) throw audit.error;

const report = JSON.parse(audit.stdout);
if (report.error) {
  console.error(report.error.summary ?? report.error);
  process.exit(1);
}

const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const source of vulnerability.via) {
    if (typeof source === "object") advisories.set(source.url, source);
  }
}

const reportedAdvisories = [...advisories.values()].filter((advisory) => !allowedAdvisories.has(advisory.url));
for (const [url, reason] of allowedAdvisories) {
  if (advisories.has(url)) {
    console.log(`Allowed ${url}: ${reason}`);
  } else {
    console.log(`::warning::${url} is no longer reported by npm audit; remove it from .github/scripts/audit.mjs`);
  }
}

if (reportedAdvisories.length > 0) {
  for (const advisory of reportedAdvisories) {
    console.error(`${advisory.severity}: ${advisory.name} ${advisory.range} - ${advisory.title} (${advisory.url})`);
  }
  process.exit(1);
}

console.log("npm audit found no advisories outside the allowlist");
