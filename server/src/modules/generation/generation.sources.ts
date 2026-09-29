import { SOURCE_MIME } from "@mihwar/shared";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { requireTenantId } from "../../lib/tenantContext.js";
import { getStorageProvider } from "../../adapters/storage.provider.js";
import { sourcePack } from "../teaching/content.service.js";
import { uploadFile, removeFile } from "../files/files.service.js";
import { getPlatformSettings } from "../platform/settings.js";
import { type Source } from "./engine.js";
import { extractText } from "./extract.js";
import { MAX_INLINE_PDF_BYTES, MAX_SOURCE_TEXT } from "./generation.service.js";

/** مصادر المقرر للتوليد: رفع ملفات الأستاذ (PDF · Word · عروض) واستخراج نصّها، وتجميع حزمة المصادر لموضوع. */
// ───────────────────────── المصادر ─────────────────────────

export async function courseOf(workspaceId: string, courseId: string) {
  const c = await prisma.course.findFirst({ where: { id: courseId, workspaceId, deletedAt: null }, select: { id: true } });
  if (!c) throw AppError.notFound("المقرر غير موجود");
  return c;
}

export async function listSources(workspaceId: string, courseId: string) {
  await courseOf(workspaceId, courseId);
  const rows = await prisma.sourceFile.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, mimeType: true, sizeBytes: true, topicId: true, fileId: true, createdAt: true, textContent: true },
  });
  return rows.map(({ textContent, ...r }) => ({ ...r, url: `/api/files/${r.fileId}`, readable: r.mimeType === "application/pdf" || !!textContent?.trim() }));
}

export async function addSource(input: { workspaceId: string; userId: string; courseId: string; topicId?: string; fileName: string; mimeType: string; data: Buffer }) {
  await courseOf(input.workspaceId, input.courseId);
  if (!(input.mimeType in SOURCE_MIME)) throw AppError.badRequest("المصادر: PDF أو Word أو PowerPoint أو ملف نصي");
  const max = (await getPlatformSettings()).ai.maxSourcesPerCourse;
  const count = await prisma.sourceFile.count({ where: { courseId: input.courseId, deletedAt: null } });
  if (count >= max) throw AppError.badRequest(`بلغ المقرر حدّ المصادر (${max}) — احذف ما لا تحتاجه`);
  if (input.topicId) {
    const t = await prisma.topic.findFirst({ where: { id: input.topicId, courseId: input.courseId, deletedAt: null }, select: { id: true } });
    if (!t) throw AppError.notFound("الموضوع غير موجود");
  }
  let text: string | null = null;
  try {
    text = extractText(input.data, input.mimeType);
  } catch {
    throw AppError.badRequest("تعذّرت قراءة الملف — تأكد أنه غير تالف واحفظه بصيغة حديثة (docx/pptx)");
  }
  const file = await uploadFile({ workspaceId: input.workspaceId, userId: input.userId, purpose: "SOURCE", fileName: input.fileName, mimeType: input.mimeType, data: input.data });
  return prisma.sourceFile.create({
    data: {
      tenantId: requireTenantId(),
      workspaceId: input.workspaceId,
      courseId: input.courseId,
      topicId: input.topicId ?? null,
      fileId: file.id,
      title: file.originalName.replace(/\.[^.]+$/, ""),
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
      textContent: text,
    },
    select: { id: true, title: true, mimeType: true, sizeBytes: true, topicId: true, createdAt: true },
  });
}

export async function removeSource(workspaceId: string, sourceId: string) {
  const s = await prisma.sourceFile.findFirst({ where: { id: sourceId, workspaceId, deletedAt: null } });
  if (!s) throw AppError.notFound("المصدر غير موجود");
  await prisma.sourceFile.update({ where: { id: s.id }, data: { deletedAt: new Date() } });
  await removeFile(workspaceId, s.fileId).catch(() => undefined);
}

export async function fileBytes(fileId: string): Promise<Buffer | null> {
  const f = await prisma.fileAsset.findFirst({ where: { id: fileId, deletedAt: null } });
  if (!f) return null;
  if (f.storage === "R2") return getStorageProvider().get(f.objectKey);
  const blob = await prisma.fileBlob.findFirst({ where: { fileId } });
  return blob ? Buffer.from(blob.data) : null;
}

/**
 * مصادر موضوع: حزمة المصادر (التوصيف · المخرجات · السياق) + نصوص الأستاذ في الموضوع +
 * مصادر المقرر المرفوعة (مصادر الموضوع أولًا ثم العامة). PDF يُرسل كما هو ضمن حدّ الحجم.
 */
export async function loadSource(workspaceId: string, courseId: string, topicId: string): Promise<Source> {
  const { text } = await sourcePack(workspaceId, topicId);
  const [materials, sources] = await Promise.all([
    prisma.lecture.findMany({
      where: { topicId, deletedAt: null, aiGenerated: false, kind: "TEXT" },
      orderBy: { createdAt: "asc" },
      select: { title: true, scriptText: true },
    }),
    prisma.sourceFile.findMany({ where: { courseId, deletedAt: null, OR: [{ topicId }, { topicId: null }] }, orderBy: { createdAt: "asc" } }),
  ]);
  sources.sort((a, b) => Number(b.topicId === topicId) - Number(a.topicId === topicId));

  const blocks: string[] = [];
  let budget = MAX_SOURCE_TEXT;
  const push = (title: string, body: string) => {
    if (budget <= 0 || !body.trim()) return;
    const part = body.slice(0, budget);
    blocks.push(`### ${title}\n${part}`);
    budget -= part.length;
  };
  for (const m of materials) push(m.title, m.scriptText ?? "");
  for (const s of sources) if (s.textContent) push(`${s.title}${s.topicId === topicId ? " (خاص بهذا الموضوع)" : ""}`, s.textContent);

  const pdfs: Buffer[] = [];
  let size = 0;
  for (const s of sources.filter((x) => x.mimeType === "application/pdf")) {
    if (size + s.sizeBytes > MAX_INLINE_PDF_BYTES) continue;
    const b = await fileBytes(s.fileId);
    if (b) {
      pdfs.push(b);
      size += b.length;
    }
  }
  const extra = [
    blocks.length ? `## مصادر الأستاذ (المرجع الأول — اعتمد عليها، وخذ منها ما يخص هذا الموضوع):\n${blocks.join("\n\n")}` : "",
    pdfs.length ? `مرفق ${pdfs.length} ملف PDF من مصادر الأستاذ — استخرج منها ما يخص هذا الموضوع تحديدًا.` : "",
  ];
  return { text: [text, ...extra].filter(Boolean).join("\n\n"), pdfs };
}
