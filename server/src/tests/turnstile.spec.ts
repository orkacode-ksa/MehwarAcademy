import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import http from "node:http";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { env } from "../config/env.js";

/** التحقق من البشر: بلا رمز أو برمز مرفوض لا تسجيل؛ برمز صحيح يمرّ. ومعطّل تمامًا بلا مفتاح. */
const app = createApp();
const PW = "Str0ngPassword!23";
const saved = { s: env.TURNSTILE_SECRET_KEY, k: env.TURNSTILE_SITE_KEY, u: env.TURNSTILE_VERIFY_URL };
let mock: http.Server;
const body = (extra: object = {}) => ({ fullName: "د. إنسان", email: `h-${crypto.randomUUID()}@mihwar.test`, password: PW, role: "TEACHER", ...extra });

beforeAll(async () => {
  mock = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const p = new URLSearchParams(raw);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ success: p.get("secret") === "sec" && p.get("response") === "human" }));
    });
  });
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", () => r()));
  Object.assign(env, { TURNSTILE_SECRET_KEY: "sec", TURNSTILE_SITE_KEY: "site", TURNSTILE_VERIFY_URL: `http://127.0.0.1:${(mock.address() as AddressInfo).port}` });
});
afterAll(() => {
  mock.close();
  Object.assign(env, { TURNSTILE_SECRET_KEY: saved.s, TURNSTILE_SITE_KEY: saved.k, TURNSTILE_VERIFY_URL: saved.u });
});

describe("التحقق من البشر", () => {
  it("المفتاح العام يُعلَن للمتصفح", async () => {
    expect((await request(app).get("/api/public/config")).body.data.turnstileSiteKey).toBe("site");
  });
  it("بلا رمز أو برمز مرفوض: لا تسجيل", async () => {
    expect((await request(app).post("/api/auth/register").set("x-forwarded-for", "10.8.0.1").send(body())).status).toBe(400);
    expect((await request(app).post("/api/auth/register").set("x-forwarded-for", "10.8.0.2").send(body({ turnstileToken: "bot" }))).status).toBe(400);
  });
  it("برمز صحيح يمرّ", async () => {
    expect((await request(app).post("/api/auth/register").set("x-forwarded-for", "10.8.0.3").send(body({ turnstileToken: "human" }))).status).toBe(201);
  });
});
