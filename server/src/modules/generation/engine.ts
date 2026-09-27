import { env } from "../../config/env.js";
import { AI_MODELS } from "../../config/aiModels.js";
import { logger } from "../../lib/logger.js";

/**
 * محرّك التوليد — داخل الخادم نفسه، بلا وسيط، بمفتاح المنصة.
 *
 * يقرأ مصادر الأستاذ (نصوصه وملفاته) ويكتب بالعربية الأكاديمية، ثم يُنطق الحوار أو السرد.
 * لا يظهر اسم أي مزوّد للمستخدم — «محرّك مِحوَر».
 *
 * الصمود: الطبقة المجانية والطلب العالي يعيدان 429/503 كثيرًا، فكل نداء يُعاد بمهلة متزايدة
 * ثم ينتقل للنموذج البديل التالي. وكل نداء يُعدّ رموزه في «العدّاد» ليُحسب أثره على الميزانية.
 */

export const writerReady = () => !!env.GEMINI_API_KEY;
export const voiceReady = () => !!env.GEMINI_API_KEY;

export interface Source {
  text: string;
  pdfs: Buffer[];
}

/** عدّاد الرموز لمهمة واحدة — يُحوَّل لتكلفة بأسعار يضبطها المالك. */
export interface Meter {
  input: number;
  output: number;
  audio: number;
}
export const newMeter = (): Meter => ({ input: 0, output: 0, audio: 0 });

const SYSTEM = `أنت عضو هيئة تدريس متمرّس في التخصص المذكور، تُعدّ مادة تعليمية جامعية لطلاب مرحلة البكالوريوس.
قواعد ملزمة:
- العربية الفصحى الأكاديمية الرصينة، بلا عامية ولا مبالغات إنشائية.
- المصطلح العلمي بالصيغة المعتمدة في المجتمع العلمي العربي (المعاجم الموحّدة ومجامع اللغة)، ويُتبع بمقابله الإنجليزي بين قوسين عند أول ذكر، ثم يُستعمل المصطلح العربي باطّراد.
- الرموز والوحدات والصيغ الكيميائية والرياضية تُكتب بصيغتها الدولية.
- مصادر الأستاذ المرفقة هي المرجع الأول؛ لا تُناقضها، وما تضيفه من خارجها يكون من المعرفة المستقرّة في التخصص.
- لا تخترع أرقامًا أو دراسات أو مراجع أو أسماء باحثين. إن لم تكن متأكدًا فلا تذكر.
- اربط المحتوى بمخرجات التعلّم المذكورة، وتدرّج من الفهم إلى التطبيق والتحليل.
- لا تذكر أنك نموذج أو برنامج، ولا تذكر أي أداة أو شركة تقنية.
- لا تستخدم صيغ LaTeX ولا علامة $ ولا كتل الشيفرة؛ اكتب الرموز بأحرف عادية (G1، CO2، 2n، m²).`;

const REVIEWER = `أنت محكّم علمي متخصص في التخصص المذكور، تراجع مادة تعليمية جامعية قبل نشرها للطلاب.
مهمتك: صحّح كل خطأ علمي، أو تعميم غير دقيق، أو نسبة عملية لكائن أو بنية لا تقوم بها، أو خلط بين
مفهومين، ووحّد المصطلحات وفق المعتمد في المجتمع العلمي العربي مع مقابلها الإنجليزي، واحذف كل معلومة
مشكوك فيها أو رقم غير موثوق. حافظ على البنية والأسلوب والطول تقريبًا، ولا تضف تعليقًا على مراجعتك.
لا تستخدم LaTeX ولا علامة $ ولا كتل الشيفرة.`;

const chain = (primary: string, fallbacks: string) => [primary, ...fallbacks.split(",").map((m) => m.trim()).filter(Boolean)].filter((m, i, a) => a.indexOf(m) === i);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Retryable extends Error {}

async function callModel(model: string, body: unknown, ms: number): Promise<GeminiResponse> {
  const res = await fetch(`${env.AI_BASE_URL}/models/${model}:generateContent`, {
    method: "POST",
    // المفتاح في ترويسة لا في الرابط — الروابط تُسجَّل في السجلات والوسطاء.
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY as string },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  if (res.ok) return (await res.json()) as GeminiResponse;
  const detail = (await res.text()).slice(0, 200);
  if (res.status === 429 || res.status >= 500) throw new Retryable(`${model} ${res.status}: ${detail}`);
  throw new Error(`${model} ${res.status}: ${detail}`);
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; inlineData?: { data?: string; mimeType?: string } }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; candidatesTokensDetails?: { modality: string; tokenCount: number }[] };
}

/** نداء صامد: محاولتان لكل نموذج بمهلة متزايدة، ثم النموذج التالي في السلسلة. */
async function resilient(models: string[], body: unknown | ((model: string) => unknown), meter: Meter, ms: number): Promise<GeminiResponse> {
  let last: unknown = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await callModel(model, typeof body === "function" ? (body as (m: string) => unknown)(model) : body, ms);
        const u = out.usageMetadata;
        meter.input += u?.promptTokenCount ?? 0;
        const audio = u?.candidatesTokensDetails?.find((d) => d.modality === "AUDIO")?.tokenCount ?? 0;
        meter.audio += audio;
        meter.output += (u?.candidatesTokenCount ?? 0) - audio;
        return out;
      } catch (err) {
        last = err;
        if (!(err instanceof Retryable) && !(err instanceof Error && err.name === "TimeoutError")) throw err;
        logger.warn({ model, attempt, err: (err as Error).message }, "المحرّك مزدحم — إعادة المحاولة");
        await sleep(env.NODE_ENV === "test" ? 5 : [2_000, 6_000, 0][attempt] ?? 0);
      }
    }
  }
  throw last instanceof Error ? last : new Error("المحرّك غير متاح الآن");
}

function sourceParts(source: Source, task: string) {
  return [
    ...source.pdfs.map((b) => ({ inlineData: { mimeType: "application/pdf", data: b.toString("base64") } })),
    { text: `${source.text}\n\n---\n${task}` },
  ];
}

/** نصّ حرّ. */
export async function write(source: Source, task: string, meter: Meter): Promise<string> {
  const out = await resilient(
    chain(AI_MODELS.heavy, env.AI_MODEL_HEAVY_FALLBACKS),
    { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: sourceParts(source, task) }] },
    meter,
    240_000,
  );
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("ردّ فارغ");
  return text.trim();
}

/** JSON منظّم — بوضع JSON الأصلي، ويُقتطع من أول قوس إلى آخره احتياطًا. */
export async function writeJson<T>(source: Source, task: string, meter: Meter): Promise<T> {
  const out = await resilient(
    chain(AI_MODELS.heavy, env.AI_MODEL_HEAVY_FALLBACKS),
    {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: sourceParts(source, `${task}\n\nأعد JSON صالحًا فقط.`) }],
      generationConfig: { responseMimeType: "application/json" },
    },
    meter,
    240_000,
  );
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("لم يُعد JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/**
 * التحكيم العلمي: قراءة ثانية للمسودة تصحّح أخطاءها قبل أن تصل للأستاذ. تكلفتها قريبة من
 * تكلفة الكتابة نفسها، ويمكن للمالك إيقافها من الإعدادات.
 */
export async function reviewText(context: string, draft: string, meter: Meter): Promise<string> {
  const out = await resilient(
    chain(AI_MODELS.heavy, env.AI_MODEL_HEAVY_FALLBACKS),
    {
      systemInstruction: { parts: [{ text: REVIEWER }] },
      contents: [{ role: "user", parts: [{ text: `${context}\n\n---\nالمسودة (Markdown):\n${draft}\n\n---\nأعد النص المصحَّح كاملًا بصيغة Markdown فقط.` }] }],
    },
    meter,
    240_000,
  );
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  // مراجعة فارغة أو مبتورة لا تُسقط المسودة الأصلية.
  return text.length > draft.length * 0.6 ? text : draft;
}

export async function reviewJson<T>(context: string, draft: T, meter: Meter): Promise<T> {
  const out = await resilient(
    chain(AI_MODELS.heavy, env.AI_MODEL_HEAVY_FALLBACKS),
    {
      systemInstruction: { parts: [{ text: REVIEWER }] },
      contents: [{ role: "user", parts: [{ text: `${context}\n\n---\nالمسودة (JSON):\n${JSON.stringify(draft)}\n\n---\nأعد JSON المصحَّح بالبنية والمفاتيح نفسها تمامًا.` }] }],
      generationConfig: { responseMimeType: "application/json" },
    },
    meter,
    240_000,
  );
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as T;
  } catch {
    return draft;
  }
}

/** بقايا تنسيق لا تُعرض: $…$ وعلامات LaTeX السفلية والعلوية وأسوار الشيفرة. */
export function tidy(md: string): string {
  return md
    .replace(/^```[^\n]*$/gm, "")
    .replace(/\$([^$\n]{1,80})\$/g, (_, x: string) => x.replace(/[_^]\{?([^}\s]+)\}?/g, "$1").replace(/\\[a-z]+/gi, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ───────────────────────── الصوت ─────────────────────────

export const SAMPLE_RATE = 24_000;
const VOICES = { A: "Kore", B: "Charon" } as const;
const TTS_MODELS = () => chain(AI_MODELS.tts, env.AI_MODEL_TTS_FALLBACKS);

/** يستخرج PCM 16-bit mono بمعدّل SAMPLE_RATE من ردّ الصوت (WAV كامل أو L16 خام). */
function pcmOf(data: Buffer, mimeType: string): Buffer {
  if (data.subarray(0, 4).toString() === "RIFF") {
    let rate = SAMPLE_RATE;
    let off = 12;
    while (off + 8 <= data.length) {
      const id = data.subarray(off, off + 4).toString();
      const size = data.readUInt32LE(off + 4);
      if (id === "fmt ") rate = data.readUInt32LE(off + 12);
      if (id === "data") {
        const pcm = data.subarray(off + 8, Math.min(data.length, off + 8 + size));
        return rate === SAMPLE_RATE ? Buffer.from(pcm) : resample(pcm, rate, SAMPLE_RATE);
      }
      off += 8 + size + (size % 2);
    }
    throw new Error("ملف صوت غير صالح");
  }
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? SAMPLE_RATE);
  return rate === SAMPLE_RATE ? data : resample(data, rate, SAMPLE_RATE);
}

/** نماذج الصوت الأقدم لا تقبل وسم المتحدّث لكل جزء، فيُرسل لها الحوار سطورًا «A: …». */
const legacyTts = (model: string) => /gemini-2\.5/.test(model);

async function tts(turns: { speaker?: "A" | "B"; text: string }[], dialogue: boolean, meter: Meter): Promise<Buffer> {
  const speechConfig = dialogue
    ? {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: (Object.keys(VOICES) as (keyof typeof VOICES)[]).map((s) => ({
            speaker: s,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[s] } },
          })),
        },
      }
    : { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES.B } } };
  const body = (model: string) => {
    const parts = !dialogue
      ? [{ text: turns.map((t) => t.text.trim()).join("\n\n") }]
      : legacyTts(model)
        ? [{ text: turns.map((t) => `${t.speaker}: ${t.text.trim()}`).join("\n") }]
        : turns.map((t) => ({ text: t.text.trim(), speechMetadata: { speaker: t.speaker as string } }));
    return { contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["AUDIO"], speechConfig } };
  };
  const out = await resilient(TTS_MODELS(), body, meter, 300_000);
  const inline = out.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error("لا صوت في الردّ");
  return pcmOf(Buffer.from(inline.data, "base64"), inline.mimeType ?? "");
}

/**
 * دفعات تقارب ٤ دقائق صوت (≈ ٤٠٠٠ حرف) — أقل عدد من الطلبات: حصة الصوت تُحسب بالطلب
 * لا بالطول، والطبقة المجانية تسمح بعدد قليل منها يوميًا.
 */
function batches<T extends { text: string }>(items: T[], max = 4000): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const it of items) {
    if (size + it.text.length > max && current.length > 0) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(it);
    size += it.text.length;
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** حوار بين متحدّثَين (A مُحاوِرة · B أستاذ) ← PCM. */
export async function speakDialogue(turns: { speaker: "A" | "B"; text: string }[], meter: Meter): Promise<Buffer> {
  const out: Buffer[] = [];
  for (const c of batches(turns)) out.push(await tts(c, true, meter));
  return Buffer.concat(out);
}

/**
 * سرد شرائح بصوت واحد في أقل عدد من الطلبات، مع وقت بداية كل شريحة. داخل الدفعة الواحدة
 * يُقسَّم زمنها على الشرائح بنسبة طول نصّها — تقدير يكفي لتبديل الشريحة مع الكلام.
 */
export async function narrateSlides(texts: string[], meter: Meter): Promise<{ pcm: Buffer; starts: number[] }> {
  const items = texts.map((text, i) => ({ text, i }));
  const starts: number[] = [];
  const parts: Buffer[] = [];
  let t = 0;
  for (const b of batches(items)) {
    const pcm = await tts(b, false, meter);
    const dur = secondsOf(pcm);
    const total = b.reduce((n, x) => n + x.text.length, 0) || 1;
    let acc = 0;
    for (const x of b) {
      starts[x.i] = Math.round((t + (dur * acc) / total) * 10) / 10;
      acc += x.text.length;
    }
    parts.push(pcm);
    t += dur;
  }
  return { pcm: Buffer.concat(parts), starts };
}

export const secondsOf = (pcm: Buffer) => pcm.length / 2 / SAMPLE_RATE;

/** PCM 16-bit mono ← WAV بمعدّل أخفض (16kHz تكفي الكلام وتوفّر ثلث الحجم). */
export function toWav(pcm: Buffer, rate = 16_000): Buffer {
  const data = rate === SAMPLE_RATE ? pcm : resample(pcm, SAMPLE_RATE, rate);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

function resample(pcm: Buffer, from: number, to: number): Buffer {
  const n = Math.floor(pcm.length / 2);
  const m = Math.floor((n * to) / from);
  const out = Buffer.alloc(m * 2);
  for (let i = 0; i < m; i++) {
    const x = (i * from) / to;
    const j = Math.floor(x);
    const a = pcm.readInt16LE(Math.min(j, n - 1) * 2);
    const b = pcm.readInt16LE(Math.min(j + 1, n - 1) * 2);
    out.writeInt16LE(Math.round(a + (b - a) * (x - j)), i * 2);
  }
  return out;
}

// ───────────────────────── المساعد: استدعاء أدوات ─────────────────────────

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * جولة واحدة للمساعد: النموذج يقترح استدعاءات أدوات (أو يردّ نصًّا). **لا تُعاد نتائج الأدوات
 * إليه** — الخادم ينفّذ ويعرض بنفسه — فلا تمرّ بيانات الطلاب بالنموذج، ولا تجد حقنةٌ في
 * البيانات نموذجًا يقرؤها. انظر docs/ai-assistant.md §٢.
 */
export async function proposeTools(
  system: string,
  contents: { role: "user" | "model"; text: string }[],
  functionDeclarations: unknown[],
  meter: Meter,
): Promise<{ text: string; calls: ToolCall[] }> {
  const out = await resilient(
    chain(AI_MODELS.chat, `${AI_MODELS.heavy},${env.AI_MODEL_HEAVY_FALLBACKS}`),
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: contents.map((c) => ({ role: c.role, parts: [{ text: c.text }] })),
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    },
    meter,
    30_000,
  );
  const parts = (out.candidates?.[0]?.content?.parts ?? []) as { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[];
  return {
    text: parts.map((p) => p.text ?? "").join("").trim(),
    calls: parts.filter((p) => p.functionCall).map((p) => ({ name: (p.functionCall as { name: string }).name, args: p.functionCall?.args ?? {} })).slice(0, 3),
  };
}
