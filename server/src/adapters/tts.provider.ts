import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface TTSResult {
  audioBase64: string;
  mimeType: string;
  durationSeconds: number;
}

export interface TTSProvider {
  readonly mode: "mock" | "gemini";
  synthesize(text: string, voice?: string): Promise<TTSResult>;
}

/** يولّد ملف WAV صامتًا بطول تناسبي — بلا اتصال إنترنت، لتطوير خط الإنتاج قبل توفر مفتاح Gemini TTS */
class MockTTSProvider implements TTSProvider {
  readonly mode = "mock" as const;

  async synthesize(text: string): Promise<TTSResult> {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const durationSeconds = Math.max(1, Math.round((words / 150) * 60)); // ~150 كلمة/دقيقة
    const wav = buildSilentWav(durationSeconds);
    return { audioBase64: wav.toString("base64"), mimeType: "audio/wav", durationSeconds };
  }
}

function buildSilentWav(durationSeconds: number): Buffer {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

/**
 * ⚠️ غير مُختبَر مقابل واجهة Gemini TTS الحية (لا مفتاح متاح وقت البناء).
 * راجعها فور توفر مفتاح حقيقي — شكل الاستجابة الصوتية (base64 PCM) يحتاج تحققًا ميدانيًا.
 */
class GeminiTTSProvider implements TTSProvider {
  readonly mode = "gemini" as const;
  private readonly model = "gemini-2.5-flash-preview-tts";

  async synthesize(text: string, voice = "Kore"): Promise<TTSResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          }),
          signal: controller.signal,
        },
      );
      if (!res.ok) throw new Error(`Gemini TTS error: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
      };
      const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inline?.data) throw new Error("لا يوجد صوت في استجابة Gemini");
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      return {
        audioBase64: inline.data,
        mimeType: inline.mimeType ?? "audio/wav",
        durationSeconds: Math.max(1, Math.round((words / 150) * 60)),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

let instance: TTSProvider | null = null;

export function getTTSProvider(): TTSProvider {
  if (instance) return instance;
  if (!env.GEMINI_API_KEY) {
    logger.warn("TTSProvider: GEMINI_API_KEY غير متوفر — التشغيل بالوضع الوهمي (صوت صامت)");
    instance = new MockTTSProvider();
  } else {
    instance = new GeminiTTSProvider();
  }
  return instance;
}
