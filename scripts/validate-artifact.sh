#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
client_manifest="${SITES_PROJECT_ROOT}/dist/client/.vite/manifest.json"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"

[[ -f "${worker}" ]] || {
  echo "Missing Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${client_manifest}" ]] || {
  echo "Missing client manifest: dist/client/.vite/manifest.json" >&2
  exit 66
}

node --input-type=module - "${worker}" "${client_manifest}" "${hosting}" <<'NODE'
import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [workerPath, clientManifestPath, hostingPath] = process.argv.slice(2);

JSON.parse(await readFile(clientManifestPath, "utf8"));

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("artifact-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error(
    "dist/server/index.js must have an ESM default export with fetch(request, env, ctx)",
  );
}

try {
  await access(hostingPath);
  JSON.parse(await readFile(hostingPath, "utf8"));
  console.log("OpenAI Sites hosting manifest detected and validated.");
} catch {
  console.log("Cloudflare artifact detected; OpenAI Sites hosting manifest is not required.");
}
NODE

echo "Validated artifact: Worker default.fetch and client manifest are present."
