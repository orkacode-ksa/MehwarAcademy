import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";

/**
 * القوائم المقنّنة — كل حقل يمكن توقّع قيمته يُختار من قائمة لا يُكتب: «ام القرى» و«أم القرى»
 * و«ام القري» ثلاث مساحات لجامعة واحدة إن كُتبت، وواحدة إن اختيرت. المالك يعدّلها من
 * «الإعدادات ← القوائم»، والجامعة تُعرَّف بمفتاح ثابت لا باسمها (تعديل الاسم لا يفصلها عن مساحتها).
 */
const list = (max = 200) => z.array(z.string().trim().min(1).max(120)).max(max);

export const catalogsSchema = z
  .object({
    universities: z
      .array(z.object({ key: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(3).max(120) }).strict())
      .max(500),
    termLabels: list(20),
    holidays: list(),
    levels: list(30),
    teachingModes: list(20),
    teachingStrategies: list(),
    assessmentMethods: list(),
    gradeComponents: list(),
    participationTypes: list(),
    specializations: list(),
    banks: list(60),
    colleges: list(),
    departments: list(400),
  })
  .strict();
export type Catalogs = z.infer<typeof catalogsSchema>;

const U = (key: string, name: string) => ({ key, name });

export const DEFAULT_CATALOGS: Catalogs = {
  universities: [
    U("uqu", "جامعة أم القرى"),
    U("ksu", "جامعة الملك سعود"),
    U("kau", "جامعة الملك عبدالعزيز"),
    U("kfupm", "جامعة الملك فهد للبترول والمعادن"),
    U("imamu", "جامعة الإمام محمد بن سعود الإسلامية"),
    U("iu", "الجامعة الإسلامية بالمدينة المنورة"),
    U("kfu", "جامعة الملك فيصل"),
    U("kku", "جامعة الملك خالد"),
    U("qu", "جامعة القصيم"),
    U("taibahu", "جامعة طيبة"),
    U("tu", "جامعة الطائف"),
    U("uoh", "جامعة حائل"),
    U("jazanu", "جامعة جازان"),
    U("ju", "جامعة الجوف"),
    U("bu", "جامعة الباحة"),
    U("ut", "جامعة تبوك"),
    U("nu", "جامعة نجران"),
    U("nbu", "جامعة الحدود الشمالية"),
    U("pnu", "جامعة الأميرة نورة بنت عبدالرحمن"),
    U("ksau-hs", "جامعة الملك سعود بن عبدالعزيز للعلوم الصحية"),
    U("iau", "جامعة الإمام عبدالرحمن بن فيصل"),
    U("psau", "جامعة الأمير سطام بن عبدالعزيز"),
    U("su", "جامعة شقراء"),
    U("mu", "جامعة المجمعة"),
    U("uj", "جامعة جدة"),
    U("ub", "جامعة بيشة"),
    U("uhb", "جامعة حفر الباطن"),
    U("seu", "الجامعة السعودية الإلكترونية"),
    U("kaust", "جامعة الملك عبدالله للعلوم والتقنية"),
    U("psu", "جامعة الأمير سلطان"),
    U("alfaisal", "جامعة الفيصل"),
    U("dah", "جامعة دار الحكمة"),
    U("effat", "جامعة عفت"),
    U("yu", "جامعة اليمامة"),
    U("pmu", "جامعة الأمير محمد بن فهد"),
    U("ubt", "جامعة الأعمال والتكنولوجيا"),
    U("um", "جامعة المعرفة"),
  ],
  termLabels: ["الفصل الأول", "الفصل الثاني", "الفصل الثالث", "الفصل الصيفي"],
  holidays: ["اليوم الوطني", "يوم التأسيس", "إجازة عيد الفطر", "إجازة عيد الأضحى", "إجازة منتصف الفصل", "إجازة نهاية الأسبوع المطوّلة"],
  levels: [
    "السنة التحضيرية",
    "المستوى الأول",
    "المستوى الثاني",
    "المستوى الثالث",
    "المستوى الرابع",
    "المستوى الخامس",
    "المستوى السادس",
    "المستوى السابع",
    "المستوى الثامن",
    "المستوى التاسع",
    "المستوى العاشر",
    "المستوى الحادي عشر",
    "المستوى الثاني عشر",
    "الدراسات العليا",
  ],
  teachingModes: ["حضوري", "عن بُعد", "مدمج"],
  teachingStrategies: ["محاضرة", "مناقشة وحوار", "عمل مخبري", "تعلّم تعاوني", "حل المشكلات", "دراسة حالة", "عروض تقديمية", "تعلّم ذاتي موجّه", "تدريب ميداني", "مشروع"],
  assessmentMethods: ["اختبار تحريري", "اختبار قصير", "اختبار عملي", "واجب", "تقرير", "مشروع", "عرض تقديمي", "مشاركة", "ملف إنجاز", "اختبار شفهي"],
  gradeComponents: ["اختبار فصلي أول", "اختبار فصلي ثانٍ", "اختبار نهائي", "واجبات", "مشاركة", "اختبارات قصيرة", "عملي", "مشروع", "تقارير المعمل"],
  participationTypes: ["حضور", "متحدث", "مقدّم ورقة علمية", "ملصق علمي", "مدرّب", "منظّم", "عضو لجنة", "رئيس جلسة"],
  specializations: ["الأحياء", "الكيمياء", "الفيزياء", "الرياضيات", "الإحصاء", "علوم الحاسب", "نظم المعلومات", "الطب", "التمريض", "الصيدلة", "طب الأسنان", "العلوم الطبية التطبيقية", "الهندسة", "العمارة", "إدارة الأعمال", "المحاسبة", "الاقتصاد", "التربية", "علم النفس", "اللغة العربية", "اللغة الإنجليزية", "الشريعة", "الدراسات الإسلامية", "التاريخ", "الجغرافيا", "القانون", "الإعلام"],
  banks: ["البنك الأهلي السعودي", "مصرف الراجحي", "بنك الرياض", "البنك السعودي الفرنسي", "البنك السعودي البريطاني (ساب)", "البنك العربي الوطني", "بنك البلاد", "بنك الجزيرة", "مصرف الإنماء", "البنك السعودي للاستثمار", "بنك الخليج الدولي - السعودية", "بنك الإمارات دبي الوطني", "بنك STC", "البنك السعودي الرقمي (D360)"],
  colleges: ["كلية العلوم", "كلية الطب", "كلية الهندسة", "كلية الحاسب والمعلومات", "كلية إدارة الأعمال", "كلية التربية", "كلية الآداب", "كلية الشريعة", "كلية الصيدلة", "كلية طب الأسنان", "كلية التمريض", "كلية العلوم الطبية التطبيقية", "كلية العلوم الاجتماعية", "كلية اللغات والترجمة", "كلية العمارة والتخطيط", "كلية الحقوق"],
  departments: ["قسم الأحياء", "قسم الكيمياء", "قسم الفيزياء", "قسم الرياضيات", "قسم الإحصاء", "قسم علوم الحاسب", "قسم نظم المعلومات", "قسم هندسة الحاسب", "قسم الهندسة الكهربائية", "قسم الهندسة المدنية", "قسم الهندسة الميكانيكية", "قسم الإدارة", "قسم المحاسبة", "قسم الاقتصاد", "قسم المناهج وطرق التدريس", "قسم علم النفس", "قسم اللغة العربية", "قسم اللغة الإنجليزية", "قسم الدراسات الإسلامية", "قسم التاريخ", "قسم الجغرافيا"],
};

let cache: { at: number; value: Catalogs } | null = null;

/** القوائم الحالية — المحفوظ فوق الافتراضي (قائمة جديدة في الشيفرة تظهر ولو لم يحفظها المالك بعد). */
export async function getCatalogs(): Promise<Catalogs> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const row = await prismaBase.platformSetting.findUnique({ where: { key: "catalogs" } });
  const merged = { ...DEFAULT_CATALOGS, ...((row?.value as Partial<Catalogs> | null) ?? {}) };
  const parsed = catalogsSchema.safeParse(merged);
  const value = parsed.success ? parsed.data : DEFAULT_CATALOGS;
  cache = { at: Date.now(), value };
  return value;
}

/**
 * حفظ المالك. مفاتيح الجامعات فريدة، ولا يُحذف مفتاح جامعة لها مساحة قائمة — حذفه يقطع
 * الربط فيعود التكرار. (إعادة تسميتها مسموحة: المفتاح هو الهوية.)
 */
export async function saveCatalogs(input: unknown): Promise<Catalogs> {
  const value = catalogsSchema.parse(input);
  const keys = value.universities.map((u) => u.key);
  if (new Set(keys).size !== keys.length) throw AppError.badRequest("مفتاح جامعة مكرر");
  const used = await prismaBase.tenant.findMany({ where: { catalogKey: { not: null }, deletedAt: null }, select: { catalogKey: true, name: true } });
  const missing = used.filter((t) => t.catalogKey && !keys.includes(t.catalogKey));
  if (missing.length) throw AppError.badRequest(`لا تُحذف جامعة لها مساحة قائمة: ${missing.map((m) => m.name).join("، ")}`);
  const dedup = (a: string[]) => [...new Set(a.map((x) => x.trim()).filter(Boolean))];
  const clean: Catalogs = {
    ...value,
    termLabels: dedup(value.termLabels),
    holidays: dedup(value.holidays),
    levels: dedup(value.levels),
    teachingModes: dedup(value.teachingModes),
    teachingStrategies: dedup(value.teachingStrategies),
    assessmentMethods: dedup(value.assessmentMethods),
    gradeComponents: dedup(value.gradeComponents),
    participationTypes: dedup(value.participationTypes),
    specializations: dedup(value.specializations),
    banks: dedup(value.banks),
    colleges: dedup(value.colleges),
    departments: dedup(value.departments),
  };
  await prismaBase.platformSetting.upsert({
    where: { key: "catalogs" },
    create: { key: "catalogs", value: clean as unknown as Prisma.InputJsonValue },
    update: { value: clean as unknown as Prisma.InputJsonValue },
  });
  cache = null;
  return clean;
}

export const universityByKey = async (key: string) => (await getCatalogs()).universities.find((u) => u.key === key) ?? null;
