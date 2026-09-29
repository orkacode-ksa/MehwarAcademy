import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { cached, invalidate } from "../lib/cache.js";
import { pageOf } from "../lib/paging.js";

describe("الذاكرة المؤقتة الموحّدة", () => {
  it("تحسب مرة واحدة للطلبات المتزامنة، وتُعيد الحساب بعد المسح", async () => {
    const key = `t:${crypto.randomUUID()}`;
    let calls = 0;
    const compute = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { n: calls, none: null };
    };
    const [a, b, c] = await Promise.all([cached(key, 60, compute), cached(key, 60, compute), cached(key, 60, compute)]);
    expect(calls).toBe(1);
    expect([a, b, c]).toEqual([{ n: 1, none: null }, { n: 1, none: null }, { n: 1, none: null }]);
    expect(await cached(key, 60, compute)).toEqual({ n: 1, none: null });
    await invalidate(key);
    expect(await cached(key, 60, compute)).toEqual({ n: 2, none: null });
  });

  it("القيمة الفارغة تُحفظ ولا تُعاد حسابها", async () => {
    const key = `t:${crypto.randomUUID()}`;
    let calls = 0;
    const compute = async () => {
      calls++;
      return null;
    };
    expect(await cached(key, 60, compute)).toBeNull();
    expect(await cached(key, 60, compute)).toBeNull();
    expect(calls).toBe(1);
  });
});

describe("تقسيم القوائم", () => {
  it("قيم افتراضية وحدود", () => {
    expect(pageOf({})).toEqual({ skip: 0, take: 100 });
    expect(pageOf({ offset: "200", limit: "50" })).toEqual({ skip: 200, take: 50 });
    expect(pageOf({ offset: "-5", limit: "100000" })).toEqual({ skip: 0, take: 200 });
    expect(pageOf({ offset: "abc", limit: "0" })).toEqual({ skip: 0, take: 1 });
  });
});
