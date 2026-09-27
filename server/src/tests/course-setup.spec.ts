import { describe, it, expect } from "vitest";
import { computeSetupProgress, SETUP_STEPS } from "../modules/academic/courseSetup.js";

/**
 * تقدّم التجهيز مُشتقّ لا مُخزَّن — فهذه الاختبارات تحرس المعنى المعروض للأستاذ:
 * «الخطوة ٣ من ٦ — التالي: توزيع الدرجات».
 */
const EMPTY = { specComplete: true, topics: 0, sections: 0, gradeScheme: [] as never[], gradeSchemeConfirmedAt: null, materials: 0, assessments: 0 };

describe("تقدّم تجهيز المقرر", () => {
  it("مقرر جديد: خطوة واحدة مكتملة والتالي هو الفهرس", () => {
    const p = computeSetupProgress(EMPTY);
    expect(p.done).toBe(1);
    expect(p.total).toBe(SETUP_STEPS.length);
    expect(p.next?.key).toBe("INDEX");
  });

  it("بعد إضافة المواضيع ينتقل التالي إلى الشُّعب", () => {
    const p = computeSetupProgress({ ...EMPTY, topics: 5 });
    expect(p.done).toBe(2);
    expect(p.next?.key).toBe("SECTIONS");
  });

  it("توزيع درجات فارغ لا يُحتسب مكتملًا", () => {
    const p = computeSetupProgress({ ...EMPTY, topics: 5, sections: 1, gradeScheme: [] });
    expect(p.next?.key).toBe("GRADES");
  });

  it("توزيع منسوخ من اللائحة بلا إقرار الأستاذ لا يُحتسب مكتملًا", () => {
    // الحالة الفعلية عند إنشاء أي مقرر: الأوزان موجودة لأنها نُسخت، والأستاذ لم يرها.
    const p = computeSetupProgress({
      ...EMPTY,
      topics: 5,
      sections: 1,
      gradeScheme: [{ key: "FINAL", label: "نهائي", weight: 100 }],
      gradeSchemeConfirmedAt: null,
    });
    expect(p.next?.key).toBe("GRADES");
    expect(p.steps.find((s) => s.key === "GRADES")?.done).toBe(false);
  });

  it("التجهيز الكامل يُرجع next = null ولا يعرض خطوة تالية", () => {
    const p = computeSetupProgress({
      specComplete: true,
      topics: 5,
      sections: 2,
      gradeScheme: [{ key: "FINAL", label: "نهائي", weight: 100 }],
      gradeSchemeConfirmedAt: new Date(),
      materials: 3,
      assessments: 2,
    });
    expect(p.done).toBe(6);
    expect(p.next).toBeNull();
  });

  it("مقرر بلا توصيف: الخطوة الأولى ناقصة والتالي هو التوصيف", () => {
    const p = computeSetupProgress({ ...EMPTY, specComplete: false, topics: 5 });
    expect(p.done).toBe(1);
    expect(p.next?.key).toBe("COURSE");
  });

  it("خطوة متقدّمة مكتملة لا تُقفز فوق خطوة ناقصة قبلها", () => {
    // الأستاذ قد يضيف تقييمات قبل الشُّعب؛ «التالي» يجب أن يبقى أقرب ناقص لا آخر مكتمل.
    const p = computeSetupProgress({ ...EMPTY, topics: 3, assessments: 4 });
    expect(p.next?.key).toBe("SECTIONS");
    expect(p.steps.find((s) => s.key === "ASSESSMENTS")?.done).toBe(true);
  });
});
