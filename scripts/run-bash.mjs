import { spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-bash.mjs <script> [...args]");
  process.exit(2);
}

const candidates =
  process.platform === "win32"
    ? [
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
        "bash.exe",
      ]
    : ["bash"];

let lastError = null;

for (const bash of candidates) {
  const result = spawnSync(bash, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (!result.error) {
    process.exit(result.status ?? 1);
  }

  lastError = result.error;
}

console.error("Unable to locate a usable Bash executable.");
if (lastError) {
  console.error(lastError.message);
}

process.exit(1);
