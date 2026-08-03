#!/usr/bin/env bash

set -euo pipefail

echo "Running bounded vinext build..."

npx vinext build

echo "vinext build completed successfully."

if [[ "${DEPLOY_TARGET:-cloudflare}" == "openai-sites" ]]; then
  manifest="dist/.openai/hosting.json"

  if [[ ! -f "$manifest" ]]; then
    echo "Missing packaged Sites manifest: $manifest"
    exit 1
  fi

  echo "OpenAI Sites manifest verified: $manifest"
else
  echo "Cloudflare build detected; skipping OpenAI Sites manifest validation."
fi

echo "Build verification completed."