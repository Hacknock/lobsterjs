import { spawnSync } from "node:child_process";

const allowedAdvisories = new Map([
  [
    "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
    "picomatch ReDoS via attacker-supplied globs; only reached through vite and vitest with globs from our own config, and no patched release exists yet",
  ],
]);

const audit = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
if (audit.error) throw audit.error;

function failWithAuditOutput(message) {
  console.error(message);
  console.error(audit.stdout);
  console.error(audit.stderr);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  failWithAuditOutput("npm audit did not return JSON");
}
if (typeof report.vulnerabilities !== "object" || report.vulnerabilities === null) {
  failWithAuditOutput("npm audit did not return a vulnerability report");
}

const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities)) {
  for (const source of vulnerability.via) {
    if (typeof source === "object") advisories.set(source.url, source);
  }
}
if (audit.status !== 0 && advisories.size === 0) {
  failWithAuditOutput(`npm audit exited with status ${audit.status} without reporting an advisory`);
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
