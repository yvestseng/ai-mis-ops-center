import { rm } from "node:fs/promises";

const paths = [
  ".wrangler",
  ".vinext",
  ".next",
  "dist",
  "node_modules/.vite",
];

for (const path of paths) {
  await rm(path, { recursive: true, force: true });
  console.log(`removed: ${path}`);
}
