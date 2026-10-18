// Automated checks only. Creates its own loopback PostgreSQL cluster; never reads .env or an existing DB.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mode = process.argv[2] ?? "backend";
if (!["backend", "browser"].includes(mode)) throw new Error("Expected backend or browser");
const task = fs.mkdtempSync(path.join(os.tmpdir(), "mihwar-academic-test-"));
const suffix = process.platform === "win32" ? ".exe" : "";
function postgresBin() {
  if (process.env.POSTGRES_BIN) return process.env.POSTGRES_BIN;
  const config = spawnSync("pg_config", ["--bindir"], { encoding: "utf8", windowsHide: true });
  if (config.status === 0) return config.stdout.trim();
  if (process.platform === "win32" && process.env.ProgramFiles) {
    const base = path.join(process.env.ProgramFiles, "PostgreSQL");
    for (const version of fs.existsSync(base) ? fs.readdirSync(base).sort().reverse() : []) {
      const bin = path.join(base, version, "bin");
      if (fs.existsSync(path.join(bin, "initdb.exe"))) return bin;
    }
  }
  throw new Error("Install PostgreSQL tools or set POSTGRES_BIN");
}
const pgBin = postgresBin(), pg = (name) => path.join(pgBin, name + suffix);
async function port() {
  return new Promise((resolve, reject) => {
    const server = net.createServer(); server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(() => resolve(value)); });
  });
}
const pgPort = await port(), apiPort = await port(), uiPort = await port();
const database = `mihwar_academic_test_${crypto.randomBytes(6).toString("hex")}`;
const admin = `postgresql://academic_test_admin@127.0.0.1:${pgPort}/${database}?schema=public`;
const env = { ...process.env };
// Do not inherit any service/provider credentials into automated tests.
for (const key of Object.keys(env)) if (/SECRET|TOKEN|PASSWORD|API_KEY|STORAGE_|REDIS|DATABASE_URL|MIGRATION_|OWNER_EMAIL|VITE_/i.test(key)) delete env[key];
Object.assign(env, { NODE_ENV: "test", DATABASE_URL: admin.replace("academic_test_admin", "mihwar_app"), MIGRATION_URL: "",
  APP_URL: `http://localhost:${uiPort}`, API_ORIGIN: `http://localhost:${apiPort}`, CLIENT_ORIGINS: `http://localhost:${uiPort}`,
  JWT_ACCESS_SECRET: crypto.randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), OWNER_MFA_REQUIRED: "false", SIGNUP_EMAIL_VERIFICATION: "off",
  GENERATION_MODE: mode === "backend" ? "inline" : "worker", PORT: String(apiPort), GEMINI_API_KEY: "", REDIS_URL: "",
  VITE_DEV_PROXY_TARGET: `http://127.0.0.1:${apiPort}`, VITE_API_ORIGIN: "", ACADEMIC_TEST_DIRECTORY: task,
  PATH: `${pgBin}${path.delimiter}${process.env.PATH ?? ""}` });
if (!env.CHROMIUM_EXECUTABLE_PATH && process.platform === "win32") {
  for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA]) {
    if (!base) continue;
    const chrome = path.join(base, "Google", "Chrome", "Application", "chrome.exe");
    if (fs.existsSync(chrome)) { env.CHROMIUM_EXECUTABLE_PATH = chrome; break; }
  }
}
function command(bin, args, cwd = repo, extra = {}) {
  const result = spawnSync(bin, args, { cwd, env: { ...env, ...extra }, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024,
    ...(path.basename(bin).startsWith("pg_ctl") ? { stdio: "ignore" } : {}) });
  if (result.status !== 0) throw new Error(`${path.basename(bin)} failed: ${result.error ?? result.stderr ?? result.stdout}`);
  return result.stdout ?? "";
}
async function run(args, cwd, log) {
  const fd = fs.openSync(path.join(task, log), "w");
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${log} failed (${code}); inspect the test log`))); });
}
const children = [];
let started = false, closing = false;
function close() {
  if (closing) return; closing = true;
  for (const child of children) child.kill();
  if (started) spawnSync(pg("pg_ctl"), ["-D", path.join(task, "pgdata"), "-m", "fast", "-w", "stop"], { windowsHide: true, stdio: "ignore" });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { close(); process.exit(1); });
async function ready(url) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* Process still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Test server did not start");
}
function background(args, cwd, log) {
  const fd = fs.openSync(path.join(task, log), "w");
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd); children.push(child);
}
try {
  command(pg("initdb"), ["-D", path.join(task, "pgdata"), "-U", "academic_test_admin", "-A", "trust", "--encoding=UTF8", "--no-locale"]);
  command(pg("pg_ctl"), ["-D", path.join(task, "pgdata"), "-l", path.join(task, "postgres.log"), "-o", `-h 127.0.0.1 -p ${pgPort}`, "-w", "start"]); started = true;
  command(pg("psql"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "academic_test_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "CREATE ROLE mihwar_app LOGIN NOSUPERUSER NOBYPASSRLS"]);
  command(pg("createdb"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "academic_test_admin", database]);
  const migrations = command(process.execPath, [path.join(repo, "node_modules/prisma/build/index.js"), "migrate", "deploy"], path.join(repo, "server"), { DATABASE_URL: admin });
  fs.writeFileSync(path.join(task, "migrations.log"), migrations);
  console.log(`Fresh temporary PostgreSQL: all migrations applied. Test artifacts: ${task}`);
  if (mode === "backend") {
    // wipe.spec has a separate shell-based harness; it is not given an admin URL here.
    await run([path.join(repo, "node_modules/vitest/vitest.mjs"), "run", "--maxWorkers=1", "--minWorkers=1", ...process.argv.slice(3)], path.join(repo, "server"), "backend-tests.log");
  } else {
    command(process.execPath, ["--import", "tsx", "server/test/academic/seed.ts"]);
    background(["--import", "tsx", "server/test/academic/server.ts"], repo, "api.log");
    background([path.join(repo, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(uiPort), "--strictPort"], path.join(repo, "client"), "ui.log");
    await ready(`${env.API_ORIGIN}/healthz`); await ready(env.APP_URL);
    for (const name of ["workflow", "sources", "review"]) {
      await run(["--test", `client/test/academic/${name}.e2e.mjs`], repo, `${name}-browser-tests.log`);
    }
  }
  console.log(`${mode} checks passed; logs retained in the temporary test directory.`);
} catch (error) { console.error(error.message); console.error(`Test artifacts: ${task}`); process.exitCode = 1; }
finally { close(); }
