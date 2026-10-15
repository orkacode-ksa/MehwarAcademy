// Read-only local API/UI verification. Never completes, revises or requests approval for a test record.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { testContext, launchBrowser } from "./context.mjs";
const { directory, manifest, origin } = testContext();
const target = manifest.diagnostic;
const prefix = "/api/workspaces/me/academic";

test("automated CHM1101 fixture: explains missing type, preserves immutable review, hides raw JSON except explicit local developer tools", { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1365, height: 960 } });
    const login = await context.request.post(`${origin}/api/auth/login`, { data: { email: manifest.teacherEmail, password: manifest.password } }); assert.equal(login.status(), 200);
    const get = async (suffix) => { const response = await context.request.get(`${origin}${prefix}${suffix}`); assert.equal(response.status(), 200); return (await response.json()).data; };
    const reviewPath = `/course-specification-versions/${target.version.id}/reviews/${target.review.id}`;
    const before = await get(reviewPath);
    assert.equal(before.status, "COMPLETED"); assert.ok(before.contentHash);
    assert.deepEqual(before.readiness.approvalReadiness.missing, ["SPECIFICATION_TYPE_REQUIRED"]);
    const page = await context.newPage(), mutations = [], errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", (route) => {
      const request = route.request();
      if (request.url().includes("/academic/") && request.method() !== "GET") { mutations.push(request.url()); return route.abort(); }
      return route.continue();
    });
    const openReview = async (query = "") => {
      await page.goto(`${origin}/courses/specification-sources/${target.sourceId}${query}`);
      const card = page.locator("li").filter({ has: page.getByText("CHM1101", { exact: true }) });
      await card.getByRole("button", { name: "فتح المقرر", exact: true }).click();
      await page.getByRole("button", { name: "طلب اعتماد", exact: true }).waitFor();
    };
    await openReview();
    const request = page.getByRole("button", { name: "طلب اعتماد", exact: true });
    assert.equal(await request.isDisabled(), true);
    const help = page.locator(`[id="${await request.getAttribute("aria-describedby")}"]`);
    const explanation = await help.innerText();
    assert.match(explanation, /حدد نوع المقرر/); assert.match(explanation, /تصحيح بمراجعة جديدة/); assert.match(explanation, /أكمل المراجعة الجديدة/);
    assert.doesNotMatch(explanation, /المسار|معمل|SPECIFICATION_TYPE_REQUIRED/);
    assert.equal(await page.locator("pre").count(), 0);
    await page.screenshot({ path: path.join(directory, "approval-request-explanation.png"), fullPage: true, animations: "disabled" });
    await page.getByRole("tab", { name: "خطة التدريب / المشروع", exact: true }).click();
    assert.equal(await page.getByLabel("بيانات الخطة التشغيلية (JSON)", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "تطبيق بيانات الخطة", exact: true }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(directory, "approval-request-mobile.png"), fullPage: true, animations: "disabled" });
    await openReview("?devTools=1");
    const developer = page.locator("details").filter({ has: page.getByText("أدوات التطوير: البيانات الأصلية", { exact: true }) });
    await developer.locator("summary").click(); assert.match(await developer.locator("pre").innerText(), /extractedData/);
    assert.deepEqual(await get(reviewPath), before);
    assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
    await context.close();
  } finally { await browser.close(); }
});

// Component fixture only: render the real editor with captured academic data; no authentication or API writes.
test("draft plan editor preserves rich evidence and unrelated fields without showing JSON", { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { success: false, error: { code: "TEST_ONLY", message: "Component fixture only" } } }));
    await page.goto(origin + "/login");
    const draft = structuredClone(target.review.reviewedData);
    for (const key of ["duration", "supervision", "activities"]) delete draft[key];
    draft.status = "IN_REVIEW";
    draft.operationalPlan = { duration: "8 weeks", activities: ["Activity from source"], supervision: { text: "Supervisor from source", sourcePages: [17] },
      additionalEvidence: { sourcePages: [17], retained: "original rich evidence" } };
    await page.evaluate(async (initial) => {
      const React = (await import("/node_modules/.vite/deps/react.js")).default;
      const { createRoot } = (await import("/node_modules/.vite/deps/react-dom_client.js")).default;
      const { SpecificationCourseEditor } = await import("/src/pages/faculty/SpecificationCourseEditor.tsx");
      const mount = document.createElement("div"); mount.dir = "rtl"; mount.id = "plan-editor-fixture"; document.body.appendChild(mount);
      function Harness() {
        const [course, setCourse] = React.useState(initial);
        window.__reviewPlanDraft = course;
        return React.createElement(SpecificationCourseEditor, { course, original: initial, fileUrl: "#source", readOnly: false, workflow: true, onChange: setCourse });
      }
      createRoot(mount).render(React.createElement(Harness));
    }, draft);
    const editor = page.locator("#plan-editor-fixture");
    await editor.getByRole("tab", { name: "خطة التدريب / المشروع", exact: true }).click();
    assert.equal(await editor.locator("pre").count(), 0);
    assert.equal(await editor.getByLabel("بيانات الخطة التشغيلية (JSON)", { exact: true }).count(), 0);
    await editor.getByLabel("المدة", { exact: true }).fill("10 weeks");
    await editor.getByLabel("الأنشطة — عنصر في كل سطر", { exact: true }).fill("Activity from source\nReviewed activity");
    const edited = await page.evaluate(() => window.__reviewPlanDraft);
    assert.equal(edited.operationalPlan.duration, "10 weeks");
    assert.deepEqual(edited.operationalPlan.activities, ["Activity from source", "Reviewed activity"]);
    assert.deepEqual(edited.operationalPlan.supervision, draft.operationalPlan.supervision);
    assert.deepEqual(edited.operationalPlan.additionalEvidence, draft.operationalPlan.additionalEvidence);
    assert.deepEqual(edited.sourcePages, draft.sourcePages); assert.deepEqual(edited.references, draft.references);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
