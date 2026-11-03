import { neon } from "@neondatabase/serverless";

export function getDatabase(env) {
  if (!env || !env.DATABASE_URL) {
    throw new Error("Database is not configured for this deployment.");
  }
  return neon(env.DATABASE_URL);
}
