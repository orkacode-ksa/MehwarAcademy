// Automated browser tests only. Main flow uses actual HTTP APIs and isolated PostgreSQL, never an AI mock/provider.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { testContext, launchBrowser } from "./context.mjs";
const { directory, manifest, origin } = testContext();
const W = "/api/workspaces/me/academic";
const browser = await launchBrowser();

test.after(() => browser.close());
async function login(email) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 960 } });
  const response = await context.request.post(`${origin}/api/auth/login`, { data: { email, password: manifest.password } });
  assert.equal(response.status(), 200, await response.text());
  const page = await context.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}
async function data(context, suffix) {
  const r = await context.request.get(`${origin}${W}${suffix}`); assert.equal(r.status(), 200, await r.text()); return (await r.json()).data;
}
async function settle(page, text) { await page.getByText(text, { exact: true }).first().waitFor({ state: "visible" }); }
let uploadedSourceId, finalVersionId, templateId;

test("automated database fixture → saved extraction → review/edit → reject/resubmit → approve/publish → create snapshot", { timeout: 180000 }, async () => {
  const teacher = await login(manifest.teacherEmail), reviewer = await login(manifest.reviewerEmail);
  try {
    const semesterId = manifest.semesterId;
    const { page, context } = teacher;
    uploadedSourceId = manifest.sourceId;
    await page.goto(`${origin}/courses/specification-sources/${uploadedSourceId}`);
    await page.getByRole("heading", { name: "نتيجة التحليل" }).waitFor();
    assert.match(await page.locator("body").innerText(), /غير محسوم|يحتاج حسمًا/);
    await page.getByRole("button", { name: "تهيئة المقررات للمراجعة" }).click();
    await page.getByRole("button", { name: "تهيئة المقررات للمراجعة" }).waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector('button')?.disabled);
    let versions;
    for (let i = 0; i < 30; i++) { versions = (await data(context, `/specification-sources/${uploadedSourceId}/course-versions`)).items; if (versions.length === 3) break; await new Promise((r) => setTimeout(r, 200)); }
    assert.equal(versions.length, 3); finalVersionId = versions.find((v) => v.academicCourse.code === "BIO1103").id;
    const card = page.locator("li").filter({ has: page.getByRole("heading", { name: "P rinciples of Ecology", exact: true }) });
    await card.getByRole("button", { name: "فتح المقرر" }).click();
    await page.getByRole("region", { name: "مراجعة توصيف المقرر" }).waitFor();
    await page.getByLabel(/الاسم بالإنجليزية/).fill("Principles of Ecology");
    await page.getByLabel("نوع توصيف المقرر").selectOption("STANDARD_COURSE");
    await page.getByLabel("إصدار التوصيف الرسمي").fill("2025");
    await page.getByLabel("هل للمقرر معمل؟").selectOption("true");

    // Explicit reviewer classification/editing; the extracted original remains untouched.
    await page.getByRole("tab", { name: "محتوى المقرر", exact: true }).click();
    const unclassified = page.getByRole("heading", { name: /^غير مصنف ·/ }).locator("..");
    await unclassified.locator("details").first().locator("summary").click();
    await unclassified.getByLabel("نوع الموضوع").first().selectOption("theoreticalTopics");
    await unclassified.locator("details").first().locator("summary").click();
    await unclassified.getByLabel("نوع الموضوع").first().selectOption("practicalTopics");
    const theory = page.getByRole("heading", { name: /^نظري ·/ }).locator("..");
    await theory.locator("details").first().locator("summary").click();
    await theory.getByLabel("ساعات الاتصال").fill("1.5");
    await theory.getByLabel(/^التفاصيل/).fill("تفصيل أدخله المراجع أثناء اختبار الواجهة");
    await theory.getByRole("button", { name: "إضافة موضوع نظري", exact: true }).click();
    await theory.locator("details").last().locator("summary").click();
    await theory.getByLabel("عنوان الموضوع").last().fill("موضوع اختبار مؤقت");
    await theory.getByRole("button", { name: "تقديم الموضوع موضوع اختبار مؤقت", exact: true }).click();
    await theory.getByRole("button", { name: "حذف الموضوع موضوع اختبار مؤقت", exact: true }).click();
    assert.equal(await theory.locator("li").count(), 1);
    await page.getByRole("tab", { name: "مخرجات التعلم", exact: true }).click();
    const domains = page.getByLabel("المجال", { exact: true });
    for (let i = 0; i < await domains.count(); i++) {
      const input = domains.nth(i); await input.evaluate((el) => { el.closest("details").open = true; });
      const old = await input.inputValue(); await input.fill(old.startsWith("Knowledge") ? "K" : old.startsWith("Skills") ? "S" : "V");
    }
    await page.getByRole("button", { name: "حفظ المسودة", exact: true }).click();
    await page.getByRole("button", { name: "حفظ المسودة", exact: true }).waitFor({ state: "visible" });
    await settle(page, "مسودة محفوظة");
    await page.screenshot({ path: path.join(directory, "review.png"), fullPage: true });
    await page.getByRole("button", { name: "إكمال المراجعة", exact: true }).click();
    await page.getByRole("button", { name: "طلب اعتماد", exact: true }).waitFor();
    await page.getByRole("button", { name: "طلب اعتماد", exact: true }).click();
    await settle(page, "بانتظار الاعتماد — القرار يخص هذه المراجعة المكتملة فقط");
    assert.equal(await page.getByRole("button", { name: "اعتماد المقرر", exact: true }).count(), 0);

    const openReviewer = async () => {
      await reviewer.page.goto(`${origin}/institutions/${manifest.tenantId}/specification-sources/${uploadedSourceId}`);
      const item = reviewer.page.locator("li").filter({ has: reviewer.page.getByRole("heading", { name: "P rinciples of Ecology", exact: true }) });
      await item.getByRole("button", { name: "فتح المقرر" }).click();
      await reviewer.page.getByRole("button", { name: "اعتماد المقرر", exact: true }).waitFor();
    };
    await openReviewer();
    await reviewer.page.getByLabel("ملاحظة القرار").fill("أعد إرسال الطلب بعد التحقق — اختبار الرفض");
    await reviewer.page.getByRole("button", { name: "رفض مع ملاحظة", exact: true }).click();
    await reviewer.page.getByRole("button", { name: "طلب اعتماد", exact: true }).waitFor();
    // Stay on the teacher's existing component: the retry must use a fresh request key after rejection.
    await page.getByRole("button", { name: "تحديث الحالة", exact: true }).click();
    await page.getByRole("button", { name: "طلب اعتماد", exact: true }).click();
    await settle(page, "بانتظار الاعتماد — القرار يخص هذه المراجعة المكتملة فقط");
    await openReviewer();
    await reviewer.page.getByRole("button", { name: "اعتماد المقرر", exact: true }).click();
    await reviewer.page.getByRole("button", { name: "نشر في كتالوج الجامعة", exact: true }).waitFor();
    await reviewer.page.screenshot({ path: path.join(directory, "approved.png"), fullPage: true });
    await reviewer.page.getByRole("button", { name: "نشر في كتالوج الجامعة", exact: true }).click();
    await settle(reviewer.page, "أصبح المقرر متاحًا لأساتذة الجامعة.");
    await page.goto(`${origin}/courses?new=1`);
    await page.getByRole("radio").first().waitFor();
    assert.match(await page.locator("body").innerText(), /Principles of Ecology/);
    const templates = await data(context, "/course-templates");
    const template = templates.find((t) => t.code === "BIO1103"); templateId = template.id;
    assert.equal(template.program, null); assert.equal(template.nameAr, null); assert.equal(template.nameEn, "Principles of Ecology");
    assert.equal(template.officialVersion, "2025");
    await page.getByRole("radio").first().check();
    await page.getByLabel("الفصل الدراسي", { exact: true }).selectOption(semesterId);
    await page.screenshot({ path: path.join(directory, "catalog.png"), fullPage: true });
    const createdResponse = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/courses/from-template"));
    await page.getByRole("button", { name: /^إنشاء المقرر/ }).click();
    const created = await createdResponse; assert.equal(created.status(), 201, await created.text()); const snapshot = (await created.json()).data;
    await page.waitForURL(/\/course\/[^/?]+$/);
    await page.getByRole("heading", { name: "Principles of Ecology", exact: true }).waitFor();
    await page.screenshot({ path: path.join(directory, "operational-course.png"), fullPage: true });
    const courses = await data(context, "/courses"); const operational = courses.find((c) => c.courseTemplateId === templateId);
    assert.equal(operational.specificationType, "STANDARD_COURSE"); assert.ok(operational.projectionVersion);
    assert.equal(operational.nameAr, null); assert.equal(operational.nameEn, template.nameEn);
    assert.equal(operational.setup.next.key, "SECTIONS"); assert.equal(operational.gradeSchemeConfirmedAt, null);
    const topics = snapshot.topics;
    const first = topics.find((t) => t.kind === "THEORETICAL"); assert.ok(first); assert.deepEqual(first.details, ["تفصيل أدخله المراجع أثناء اختبار الواجهة"]);
    assert.equal(Number(first.contactHours), 1.5); assert.ok(first.sourcePages.length);
    assert.ok(topics.find((topic) => topic.kind === "PRACTICAL" && topic.sourcePages.length));
    const source = await data(context, `/specification-sources/${uploadedSourceId}`);
    assert.equal(source.approvalStatus, "NOT_REQUESTED"); assert.equal(source.courseWorkflowSummary.publishedVersions, 1); assert.equal(source.courseWorkflowSummary.totalVersions, 3);
    const version = await data(context, `/course-specification-versions/${finalVersionId}`);
    assert.equal(version.extractedData.nameEn, "P rinciples of Ecology"); assert.equal(version.currentReview.reviewedData.nameEn, "Principles of Ecology");
    assert.equal(teacher.errors.length, 0, teacher.errors.join("\n")); assert.equal(reviewer.errors.length, 0, reviewer.errors.join("\n"));
    fs.writeFileSync(path.join(directory, "e2e-result.json"), JSON.stringify({ uploadedSourceId, finalVersionId, templateId, courseId: operational.id, screenshots: [ "review.png", "approved.png", "catalog.png", "operational-course.png"] }, null, 2));
  } finally { await teacher.context.close(); await reviewer.context.close(); }
});

test("automated UI edges: catalog languages/legacy/new and empty/error/no-term states", { timeout: 60000 }, async () => {
  const teacher = await login(manifest.teacherEmail);
  try {
    const { page } = teacher;
    // Request fixtures are restricted to this automated browser test.
    const templates = [
      { id: "ar", code: "AR1", nameAr: "مقرر عربي", nameEn: null, creditHours: 3, hasLab: false, college: null, program: null, programSpecification: null, _count: { topics: 1 } },
      { id: "en", code: "EN1", nameAr: null, nameEn: "English course", creditHours: 3, hasLab: false, college: null, program: null, programSpecification: null, _count: { topics: 1 } },
      { id: "bi", code: "BI1", nameAr: "مقرر ثنائي", nameEn: "Bilingual", creditHours: 3, hasLab: false, college: null, program: null, programSpecification: null, _count: { topics: 1 } },
      { id: "legacy", code: "OLD1", nameAr: "قالب البرنامج السابق", creditHours: 3, hasLab: false, college: null, department: { nameAr: "قسم" }, program: { nameAr: "برنامج" }, programSpecification: { id: "legacy-spec", version: "2025" }, _count: { topics: 1 } },
    ];
    await page.route("**/api/workspaces/me/academic/course-templates", (route) => route.fulfill({ json: { success: true, data: templates } }));
    await page.route("**/api/workspaces/me/academic/terms", (route) => route.fulfill({ json: { success: true, data: [] } }));
    await page.goto(`${origin}/courses?new=1`); await page.getByRole("radio").first().waitFor();
    for (const title of ["مقرر عربي", "English course", "مقرر ثنائي", "قالب البرنامج السابق"]) assert.match(await page.locator("body").innerText(), new RegExp(title));
    assert.doesNotMatch(await page.locator("body").innerText(), /undefined/);
    assert.equal(await page.getByRole("button", { name: "رفع توصيف أكاديمي", exact: true }).count(), 1);
    assert.match(await page.locator("body").innerText(), /لا يوجد فصل/);
    assert.equal(await page.getByRole("button", { name: /^إنشاء المقرر/ }).isDisabled(), true);
    await page.unroute("**/api/workspaces/me/academic/course-templates");
    await page.route("**/api/workspaces/me/academic/course-templates", (route) => route.fulfill({ json: { success: true, data: [] } }));
    await page.reload(); await settle(page, "لا توجد قوالب أكاديمية منشورة في جامعتك الآن. ستظهر هنا بعد اعتمادها ونشرها.");
    await page.unroute("**/api/workspaces/me/academic/course-templates");
    await page.route("**/api/workspaces/me/academic/course-templates", (route) => route.fulfill({ status: 503, json: { success: false, error: { message: "تعذّر تحميل الكتالوج" } } }));
    await page.reload(); await page.getByRole("button", { name: "إعادة تحميل القوالب", exact: true }).waitFor();
    assert.equal(teacher.errors.length, 0, teacher.errors.join("\n"));
  } finally { await teacher.context.close(); }
});

test("automated UI retry: FAILED publication sends retry=true and refreshes its result", { timeout: 60000 }, async () => {
  assert.ok(finalVersionId, "Main production API browser flow must succeed first");
  const reviewer = await login(manifest.reviewerEmail);
  try {
    const { page, context } = reviewer;
    const suffix = `/api/owner/institutions/${manifest.tenantId}/academic/course-specification-versions/${finalVersionId}`;
    const actual = (await (await context.request.get(`${origin}${suffix}`)).json()).data;
    let failed = true, retries = 0;
    await page.route(`**${suffix}`, (route) => route.fulfill({ json: { success: true, data: failed ? { ...actual,
      publication: { ...actual.publication, status: "FAILED", template: null } } : actual } }));
    await page.route(`**${suffix}/publications`, (route) => { assert.equal(route.request().postDataJSON().retry, true); retries++; failed = false; return route.continue(); });
    await page.goto(`${origin}/institutions/${manifest.tenantId}/specification-sources/${uploadedSourceId}`);
    await page.locator("li").filter({ has: page.getByRole("heading", { name: "P rinciples of Ecology", exact: true }) }).getByRole("button", { name: "فتح المقرر" }).click();
    await page.getByRole("button", { name: "إعادة محاولة النشر", exact: true }).click();
    await settle(page, "أصبح المقرر متاحًا لأساتذة الجامعة."); assert.equal(retries, 1);
    assert.equal(reviewer.errors.length, 0, reviewer.errors.join("\n"));
  } finally { await reviewer.context.close(); }
});

test("actual upload without extraction: no synthetic candidates and clear provider-unavailable state", { timeout: 60000 }, async () => {
  const teacher = await login(manifest.teacherEmail);
  try {
    const { page, context } = teacher;
    await page.goto(`${origin}/courses?sources=1`);
    await page.getByRole("button", { name: "رفع توصيف أكاديمي", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "automated-unprocessed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nAutomated upload fixture\n%%EOF") });
    const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/academic/specification-sources"));
    await page.getByRole("button", { name: "رفع الملف", exact: true }).click();
    const saved = await response;
    assert.equal(saved.status(), 201);
    const source = (await saved.json()).data;
    assert.equal(source.currentExtraction, null);
    assert.equal(source.developmentReviewPreviewAvailable, undefined);
    await page.goto(`${origin}/courses/specification-sources/${source.id}`);
    await page.getByText("لم تتوفر نتيجة تحليل مكتملة لهذا الملف بعد. لن تظهر مقررات مقترحة قبل حفظ نتيجة فعلية.", { exact: true }).waitFor();
    assert.equal((await data(context, `/specification-sources/${source.id}/course-versions`)).items.length, 0);
    assert.equal(await page.getByRole("button", { name: "تهيئة المقررات للمراجعة", exact: true }).count(), 0);
    await page.getByRole("button", { name: "بدء استخراج التوصيف", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "خدمة استخراج التوصيف غير متاحة حاليًا" }).waitFor();
    assert.equal((await data(context, `/specification-sources/${source.id}/extractions`)).length, 0);
    assert.equal(teacher.errors.length, 0, teacher.errors.join("\n"));
  } finally { await teacher.context.close(); }
});
