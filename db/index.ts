import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export type DatabaseEnv = {
  DB: D1Database;
};

export function getDb() {
  const bindings = env as unknown as DatabaseEnv;

  if (!bindings.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. " +
        "Confirm that the D1 binding name is configured as `DB`.",
    );
  }

  return drizzle(bindings.DB, { schema });
}