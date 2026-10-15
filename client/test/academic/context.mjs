import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";

export function testContext() {
  const directory = path.resolve(process.env.ACADEMIC_TEST_DIRECTORY ?? "");
  if (process.env.NODE_ENV !== "test" || !directory.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(directory).startsWith("mihwar-academic-test-")) throw new Error("Run through the isolated automated test harness");
  const database = new URL(process.env.DATABASE_URL);
  if (database.hostname !== "127.0.0.1" || !database.pathname.startsWith("/mihwar_academic_test_")) throw new Error("An isolated test database is required");
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  return { directory, manifest, origin: manifest.origin };
}

export async function launchBrowser() {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) return chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  // Prefer the pinned Playwright browser; a system Chrome installation is also suitable for local checks.
  if (fs.existsSync(chromium.executablePath())) return chromium.launch({ headless: true });
  return chromium.launch({ headless: true, channel: "chrome" });
}
