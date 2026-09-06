import { env } from "../config/env.js";
import { AI_BASE_URL, AI_MODELS } from "../config/aiModels.js";
import { logger } from "../lib/logger.js";

export interface LectureScriptResult {
  title: string;
  sections: { heading: string; body: string }[];
  estimatedMinutes: number;
}

export interface AIProvider {
  readonly mode: "mock" | "gemini";
  generateLectureScript(input: {
    topicTitle: string;
    learningOutcomes: string[];
    referenceExcerpts: string[];
    depth: "مختصر" | "متوسط" | "موسّع";
  }): Promise<LectureScriptResult>;
  generateQuestionBank(input: {
    topicTitle: string;
    learningOutcomes: string[];
    count: number;
  }): Promise<{ question: string; choices: string[]; correctIndex: number }[]>;
}

/** تطبيق وهمي حتمي — بلا اتصال إنترنت — لتطوير خط الإنتاج قبل توفر مفتاح Gemini */
class MockAIProvider implements AIProvider {
  readonly mode = "mock" as const;

  async generateLectureScript(input: {
    topicTitle: string;
    learningOutcomes: string[];
    referenceExcerpts: string[];
    depth: "مختصر" | "متوسط" | "موسّع";
  }): Promise<LectureScriptResult> {
    const outcomesList = input.learningOutcomes.length
      ? input.learningOutcomes.map((o, i) => `${i + 1}. ${o}`).join("\n")
      : "لا توجد مخرجات تعلم محددة بعد.";
    return {
      title: input.topicTitle,
      sections: [
        {
          heading: "مقدمة",
          body: `هذا نص محاضرة تجريبي (وضع وهمي — لم يُتصل بأي نموذج ذكاء حقيقي) حول "${input.topicTitle}".`,
        },
        { heading: "مخرجات التعلم المستهدفة", body: outcomesList },
        {
          heading: "المحتوى",
          body: `مستوى العمق المطلوب: ${input.depth}. عدد المراجع المرفقة: ${input.referenceExcerpts.length}.`,
        },
      ],
      estimatedMinutes: input.depth === "موسّع" ? 25 : input.depth === "متوسط" ? 15 : 8,
    };
  }

  async generateQuestionBank(input: {
    topicTitle: string;
    learningOutcomes: string[];
    count: number;
  }): Promise<{ question: string; choices: string[]; correctIndex: number }[]> {
    return Array.from({ length: input.count }, (_, i) => ({
      question: `سؤال تجريبي رقم ${i + 1} حول ${input.topicTitle}`,
      choices: ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"],
      correctIndex: 0,
    }));
  }
}

/**
 * تطبيق Gemini الحقيقي — يُستخدم فقط عند توفر GEMINI_API_KEY.
 * ⚠️ غير مُختبَر مقابل واجهة جيميني الحية في هذه الجولة (لا مفتاح متاح وقت البناء).
 * راجع مخرجاته فور توفر مفتاح حقيقي قبل الاعتماد عليه في الإنتاج.
 */
class GeminiAIProvider implements AIProvider {
  readonly mode = "gemini" as const;

  async generateLectureScript(input: {
    topicTitle: string;
    learningOutcomes: string[];
    referenceExcerpts: string[];
    depth: "مختصر" | "متوسط" | "موسّع";
  }): Promise<LectureScriptResult> {
    const prompt = [
      "أنت مساعد أكاديمي. اكتب نص محاضرة عربية منظّمة حول الموضوع التالي.",
      `الموضوع: ${input.topicTitle}`,
      `مخرجات التعلم: ${input.learningOutcomes.join("، ") || "غير محددة"}`,
      `مستوى العمق: ${input.depth}`,
      "أرجع JSON فقط بالصيغة: {\"title\":string,\"sections\":[{\"heading\":string,\"body\":string}],\"estimatedMinutes\":number}",
    ].join("\n");

    const text = await this.callGemini(prompt);
    try {
      return JSON.parse(text) as LectureScriptResult;
    } catch (err) {
      logger.error({ err }, "تعذّر تحليل استجابة Gemini كـ JSON — الرجوع لنص خام");
      return { title: input.topicTitle, sections: [{ heading: "محتوى", body: text }], estimatedMinutes: 10 };
    }
  }

  async generateQuestionBank(input: {
    topicTitle: string;
    learningOutcomes: string[];
    count: number;
  }): Promise<{ question: string; choices: string[]; correctIndex: number }[]> {
    const prompt = [
      `أنشئ ${input.count} سؤال اختيار من متعدد بالعربية حول "${input.topicTitle}".`,
      `مخرجات التعلم: ${input.learningOutcomes.join("، ") || "غير محددة"}`,
      "أرجع JSON فقط: [{\"question\":string,\"choices\":[string,string,string,string],\"correctIndex\":number}]",
    ].join("\n");
    const text = await this.callGemini(prompt);
    try {
      return JSON.parse(text) as { question: string; choices: string[]; correctIndex: number }[];
    } catch (err) {
      logger.error({ err }, "تعذّر تحليل بنك الأسئلة من Gemini");
      return [];
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(
        `${AI_BASE_URL}/models/${AI_MODELS.heavy}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("استجابة Gemini فارغة");
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}

let instance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (instance) return instance;
  if (!env.GEMINI_API_KEY) {
    logger.warn("AIProvider: GEMINI_API_KEY غير متوفر — التشغيل بالوضع الوهمي");
    instance = new MockAIProvider();
  } else {
    instance = new GeminiAIProvider();
  }
  return instance;
}
