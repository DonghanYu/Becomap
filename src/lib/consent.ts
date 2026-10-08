import { readFile } from "node:fs/promises";
import path from "node:path";

export const CONSENT_VERSION = "v1-draft";

export async function readConsentText(): Promise<string> {
  return readFile(path.join(process.cwd(), "content", "consent_v1.md"), "utf-8");
}
