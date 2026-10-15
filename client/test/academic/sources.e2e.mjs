// Read-only UX check of the sources page. Does not resume AI, upload, review, approve or publish.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { testContext, launchBrowser } from "./context.mjs";
const { directory, manifest, origin } = testContext();

test("course/source modes: exclusive content, preserved drafts, URL history, paused progress, no preview sections and RTL", { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1365, height: 960 } });
    const login = await context.request.post(`${origin}/api/auth/login`, { data: { email: manifest.teacherEmail, password: manifest.password } });
    assert.equal(login.status(), 200);
    const page = await context.newPage(), errors = [], mutations = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) => {
      const request = route.request();
      if (request.url().includes("/academic/") && request.method() !== "GET") { mutations.push(request.url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(`${origin}/courses?sources=1`);
    const panel = page.locator('[aria-labelledby="academic-source-title"]');
    const reference = panel.locator("article").filter({ has: page.locator(`[id="specification-source-${manifest.pausedSourceId}"]`) });
    await reference.getByRole("button", { name: "استكمال التحليل", exact: true }).waitFor();
    const modes = page.getByRole("group", { name: "عرض المقررات والتوصيفات", exact: true });
    const coursesMode = modes.getByRole("button", { name: "مقرراتي", exact: true });
    const sourcesMode = modes.getByRole("button", { name: "التوصيفات الأكاديمية", exact: true });
    assert.equal(await sourcesMode.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('a[href^="/course/"]:visible').count(), 0);
    assert.equal(await page.getByRole("button", { name: "مقرر جديد", exact: true }).count(), 0);
    assert.doesNotMatch(await page.locator("body").innerText(), /Principles of Ecology|التالي:|معاينة المقرر/);
    const text = await reference.innerText();
    assert.match(text, /توقف التحليل مؤقتًا/); assert.match(text, /اكتملت 35 من 52 دفعة/); assert.match(text, /المتبقي 17 دفعة/);
    assert.doesNotMatch(text, /تعذّر الاستخراج|تعذر استخراج|429|FAILED|معاينة المراجعة/);
    assert.equal(await reference.getByRole("button").count(), 1);
    assert.equal(await panel.getByRole("button", { name: "رفع توصيف أكاديمي", exact: true }).isVisible(), true);
    assert.equal(await panel.getAttribute("dir"), "rtl");
    assert.equal(await panel.locator('details[aria-label="\u0628\u064a\u0627\u0646\u0627\u062a \u062a\u062c\u0631\u0628\u0629 \u0645\u062d\u0644\u064a\u0629"]').count(), 0);
    await panel.getByRole("button", { name: "رفع توصيف أكاديمي", exact: true }).click();
    assert.equal(await panel.getByRole("button", { name: "اختر ملف PDF", exact: true }).isVisible(), true);
    await panel.getByRole("button", { name: "رفع توصيف أكاديمي", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(directory, "sources-clean-mobile.png"), fullPage: true, animations: "disabled" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

    // Preserve a real PDF selection and the upload draft without uploading or mutating anything.
    await page.setViewportSize({ width: 1365, height: 960 });
    await panel.getByRole("button", { name: "رفع توصيف أكاديمي", exact: true }).click();
    const pdf = await context.request.get(`${origin}/api/workspaces/me/academic/specification-sources/${manifest.pausedSourceId}/file`);
    assert.equal(pdf.status(), 200);
    const fileInput = panel.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: "ملف التنقل.pdf", mimeType: "application/pdf", buffer: await pdf.body() });

    await coursesMode.click();
    await page.waitForURL((url) => url.pathname === "/courses" && !url.searchParams.has("sources"));
    const coursePanel = page.locator("#courses-view");
    await coursePanel.locator('a[href^="/course/"]').first().waitFor();
    assert.equal(await coursesMode.getAttribute("aria-pressed"), "true");
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.getByRole("button", { name: "رفع توصيف أكاديمي", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "مقرر جديد", exact: true }).isVisible(), true);
    assert.doesNotMatch(await page.locator("body").innerText(), /المصادر الحالية|بيانات تجربة محلية/);
    const courseCards = coursePanel.locator("article");
    assert.equal(await coursePanel.locator("progress").count(), 0);
    assert.doesNotMatch(await coursePanel.innerText(), /اكتمل \d+ من \d+|التالي:|خطوات التجهيز/);
    for (const card of await courseCards.all()) {
      assert.match(await card.innerText(), /جاهز للتدريس|يحتاج إعدادًا بسيطًا|قيد التجهيز|يحتاج استكمال/);
      assert.equal(await card.getByRole("link").count(), 1);
      assert.ok(((await card.innerText()).match(/المتبقي:/g) || []).length <= 1);
    }
    assert.equal(await page.locator('[aria-labelledby="new-template-course-title"]').count(), 0);
    await page.screenshot({ path: path.join(directory, "courses-only-desktop.png"), fullPage: true, animations: "disabled" });

    const courseResponse = await context.request.get(`${origin}/api/workspaces/me/academic/courses`);
    assert.equal(courseResponse.status(), 200);
    const actualCourses = (await courseResponse.json()).data;
    const semesterId = actualCourses[0].semester.id;
    const semesterFilter = page.getByRole("combobox", { name: "تصفية المقررات حسب الفصل الدراسي", exact: true });
    await semesterFilter.selectOption(semesterId);
    const semesterCount = actualCourses.filter((course) => course.semester.id === semesterId).length;
    await page.waitForFunction((count) => document.querySelectorAll("#courses-view article").length === count, semesterCount);
    assert.equal(await courseCards.count(), semesterCount);

    await page.getByRole("button", { name: "مقرر جديد", exact: true }).click();
    const form = page.locator('[aria-labelledby="new-template-course-title"]');
    const query = form.getByRole("searchbox");
    await query.waitFor(); await query.fill("Ecology");
    await form.getByRole("radio").first().check();
    const selectedTemplate = await form.locator('input[type="radio"]:checked').getAttribute("value");
    await form.getByLabel("الفصل الدراسي", { exact: true }).selectOption(manifest.semesterId);
    assert.equal(await form.getByRole("button", { name: "رفع توصيف أكاديمي", exact: true }).count(), 1);

    await sourcesMode.click();
    await page.waitForURL((url) => url.searchParams.get("sources") === "1");
    await form.waitFor({ state: "hidden" }); await panel.waitFor({ state: "visible" });
    assert.equal(await form.isVisible(), false); assert.equal(await coursePanel.isVisible(), false);
    assert.equal(await page.locator('a[href^="/course/"]:visible').count(), 0);
    assert.equal(await panel.getByRole("button", { name: "تغيير ملف PDF", exact: true }).isVisible(), true);
    assert.equal(await fileInput.evaluate((input) => input.files?.[0]?.name), "ملف التنقل.pdf");
    assert.doesNotMatch(await page.locator("body").innerText(), /Principles of Ecology|التالي:|معاينة المقرر/);

    await coursesMode.click();
    await form.waitFor({ state: "visible" });
    assert.equal(await query.inputValue(), "Ecology");
    assert.equal(await form.locator('input[type="radio"]:checked').getAttribute("value"), selectedTemplate);
    assert.equal(await form.getByLabel("الفصل الدراسي", { exact: true }).inputValue(), manifest.semesterId);
    assert.equal(await semesterFilter.inputValue(), semesterId);
    assert.equal(await panel.isVisible(), false);
    await page.goBack(); await panel.waitFor({ state: "visible" }); await form.waitFor({ state: "hidden" });
    assert.equal(await sourcesMode.getAttribute("aria-pressed"), "true"); assert.equal(await form.isVisible(), false);
    assert.equal(await fileInput.evaluate((input) => input.files?.[0]?.name), "ملف التنقل.pdf");
    await page.goForward();
    await form.waitFor({ state: "visible" });
    assert.equal(await coursesMode.getAttribute("aria-pressed"), "true"); assert.equal(await query.inputValue(), "Ecology");
    await form.getByRole("button", { name: "إلغاء", exact: true }).click();
    await form.waitFor({ state: "detached" });
    assert.equal(await form.count(), 0);
    assert.equal(new URL(page.url()).searchParams.has("new"), false);
    assert.equal(await semesterFilter.inputValue(), semesterId);
    assert.equal(await courseCards.count(), semesterCount);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(directory, "courses-simple-mobile.png"), fullPage: true, animations: "disabled" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

    await page.goto(`${origin}/courses`);
    await page.locator('#courses-view a[href^="/course/"]').first().waitFor();
    assert.equal(await page.locator('[aria-labelledby="academic-source-title"]').count(), 0);
    assert.equal(await page.locator("#courses-view").getAttribute("dir") ?? await page.locator("#courses-view").locator("..").getAttribute("dir"), "rtl");
    assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
    await context.close();
  } finally { await browser.close(); }
});
