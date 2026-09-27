import { env } from "../../config/env.js";
import { AI_MODELS } from "../../config/aiModels.js";

/**
 * محرّك التوليد — داخل الخادم نفسه، بلا وسيط.
 *
 * الكاتب: Claude إن وُجد `ANTHROPIC_API_KEY` (أدقّ عربيةً وأشدّ التزامًا بالمصادر)، وإلا Gemini.
 * الصوت: Gemini TTS دائمًا — هو محرّك «الملخّص الصوتي» نفسه في NotebookLM، ويدعم متحدّثَين.
 * كلاهما يقرأ ملفات PDF التي رفعها الأستاذ في الموضوع مباشرة، فالناتج مبنيّ على مصادره هو.
 */

export type Writer = "claude" | "gemini";

export function writerOf(): Writer | null {
  if (env.ANTHROPIC_API_KEY) return "claude";
  if (env.GEMINI_API_KEY) return "gemini";
  return null;
}
export const voiceReady = () => !!env.GEMINI_API_KEY;

export interface Source {
  text: string;
  pdfs: Buffer[];
}

const SYSTEM = [
  "أنت أستاذ جامعي خبير تُعدّ مواد تعليمية بالعربية الفصحى الواضحة لطلاب جامعيين.",
  "التزم بالمصادر المرفقة وبمخرجات التعلّم المذكورة، ولا تذكر معلومة لست واثقًا منها.",
  "اكتب المصطلح العلمي بالعربية ثم مقابله الإنجليزي بين قوسين عند أول ذكر.",
].join("\n");

async function post(url: string, headers: Record<string, string>, body: unknown, ms: number) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<unknown>;
}

/** نصّ حرّ من الكاتب. */
export async function write(source: Source, task: string): Promise<string> {
  const writer = writerOf();
  if (!writer) throw new Error("لا مفتاح كاتب");
  const prompt = `${source.text}\n\n---\n${task}`;

  if (writer === "claude") {
    const content = [
      ...source.pdfs.map((b) => ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b.toString("base64") } })),
      { type: "text", text: prompt },
    ];
    const out = (await post(
      `${env.ANTHROPIC_BASE_URL}/v1/messages`,
      { "x-api-key": env.ANTHROPIC_API_KEY as string, "anthropic-version": "2023-06-01" },
      { model: env.AI_MODEL_WRITER, max_tokens: 8000, system: SYSTEM, messages: [{ role: "user", content }] },
      240_000,
    )) as { content?: { type: string; text?: string }[] };
    const text = out.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("ردّ فارغ من الكاتب");
    return text.trim();
  }

  const parts = [...source.pdfs.map((b) => ({ inlineData: { mimeType: "application/pdf", data: b.toString("base64") } })), { text: prompt }];
  const out = (await post(
    `${env.AI_BASE_URL}/models/${AI_MODELS.heavy}:generateContent?key=${env.GEMINI_API_KEY}`,
    {},
    { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts }] },
    240_000,
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("ردّ فارغ من الكاتب");
  return text.trim();
}

/** JSON من الكاتب — يُطلب صراحةً ويُقتطع من أول قوس إلى آخره (يتسامح مع ```json). */
export async function writeJson<T>(source: Source, task: string): Promise<T> {
  const text = await write(source, `${task}\n\nأعد JSON صالحًا فقط، بلا أي نص قبله أو بعده.`);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("الكاتب لم يُعد JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

// ───────────────────────── الصوت ─────────────────────────

export const SAMPLE_RATE = 24_000;
const VOICES = { A: "Kore", B: "Charon" } as const;

async function tts(text: string, speakers: boolean): Promise<Buffer> {
  const speechConfig = speakers
    ? {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: (Object.keys(VOICES) as (keyof typeof VOICES)[]).map((s) => ({
            speaker: s,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[s] } },
          })),
        },
      }
    : { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES.B } } };
  const out = (await post(
    `${env.AI_BASE_URL}/models/${AI_MODELS.tts}:generateContent?key=${env.GEMINI_API_KEY}`,
    {},
    { contents: [{ role: "user", parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig } },
    180_000,
  )) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
  const inline = out.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error("لا صوت في ردّ Gemini");
  const rate = Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? SAMPLE_RATE);
  const pcm = Buffer.from(inline.data, "base64");
  return rate === SAMPLE_RATE ? pcm : resample(pcm, rate, SAMPLE_RATE);
}

/** حوار بين متحدّثَين (A مقدّمة · B أستاذ) ← PCM. يُقسَّم لدفعات فلا يتجاوز حدّ الطلب الواحد. */
export async function speakDialogue(turns: { speaker: "A" | "B"; text: string }[]): Promise<Buffer> {
  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const t of turns) {
    const line = `${t.speaker}: ${t.text.trim()}`;
    if (size + line.length > 2500 && current.length > 0) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.length;
  }
  if (current.length > 0) chunks.push(current);
  const out: Buffer[] = [];
  for (const c of chunks) out.push(await tts(`اقرأ هذا الحوار العربي بنبرة ودّية واضحة كبودكاست تعليمي:\n${c.join("\n")}`, true));
  return Buffer.concat(out);
}

/** سرد بصوت واحد ← PCM. */
export async function narrate(text: string): Promise<Buffer> {
  return tts(`اقرأ بالعربية بنبرة أستاذ هادئة واضحة:\n${text.trim()}`, false);
}

export const secondsOf = (pcm: Buffer) => pcm.length / 2 / SAMPLE_RATE;

/** صمت قصير بين الشرائح. */
export const silence = (seconds: number) => Buffer.alloc(Math.round(seconds * SAMPLE_RATE) * 2);

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
