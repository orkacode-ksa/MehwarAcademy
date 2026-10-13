import { useState } from "react";
import { courseReviewReadiness, type ReviewedCourseSpecification } from "@mihwar/shared";
import { Button } from "../../components/ui/Button.js";
import { Input, Label, Select, Textarea } from "../../components/ui/Form.js";
import { formatNum } from "../../lib/numerals.js";

type Course = ReviewedCourseSpecification;
type TopicGroup = "theoreticalTopics" | "practicalTopics" | "unclassifiedTopics";
type ReferenceGroup = keyof Course["references"];
const TOPIC_GROUPS: [TopicGroup, string][] = [["theoreticalTopics", "نظري"], ["practicalTopics", "عملي"], ["unclassifiedTopics", "غير مصنف"]];
const REFERENCE_GROUPS: [ReferenceGroup, string][] = [["essential", "مراجع أساسية"], ["supportive", "مراجع مساندة"],
  ["electronicMaterials", "مواد إلكترونية"], ["otherLearningMaterials", "مواد تعلم أخرى"], ["unclassified", "مراجع غير مصنفة"]];
const humanId = () => `human:${crypto.randomUUID()}`;

function TextList({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <Label text={`${label} — عنصر في كل سطر`}><Textarea value={values.join("\n")} onChange={(event) => onChange(event.target.value.split("\n"))} /></Label>;
}

function SourcePages({ pages, fileUrl }: { pages: number[]; fileUrl: string }) {
  return <p className="text-[11.5px] text-ink-3 mt-2">{pages.length ? <>صفحات المصدر: {pages.map((page, index) => <span key={page}>
    {index > 0 && "، "}<a href={`${fileUrl}#page=${page}`} target="_blank" rel="noopener noreferrer" className="underline">{formatNum(page)}</a>
  </span>)}</> : "إدخال الأستاذ — لم تُنسب له صفحات من الملف"}</p>;
}

export function SpecificationCourseEditor({ course, original, fileUrl, readOnly, onChange }: {
  course: Course; original: Course | undefined; fileUrl: string; readOnly: boolean; onChange: (course: Course) => void;
}) {
  const [section, setSection] = useState("basic");
  const readiness = courseReviewReadiness(course);
  const scalar = (key: keyof Course, label: string, recommended = false, numeric = false) => {
    const value = course[key]; const old = original?.[key];
    const required = ["courseTitle", "courseCode", "creditHours"].includes(key);
    const empty = value === null || value === "";
    return <Label key={key} text={<>{label} {empty && <span className={required ? "text-crim" : "text-ink-3"}>· {required ? "مطلوب قبل الاعتماد" : recommended ? "يمكن استكماله" : "اختياري"}</span>}</>}>
      <Input type={numeric ? "number" : "text"} step={numeric ? key === "creditHours" ? "1" : "any" : undefined}
        min={numeric ? 0 : undefined} max={numeric ? key === "creditHours" ? 12 : 1000 : undefined}
        className={empty ? "border-amber-500/40 bg-amber-50/20" : ""} placeholder="غير محدد"
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        onChange={(event) => onChange({ ...course, [key]: event.target.value === "" ? null : numeric ? Number(event.target.value) : event.target.value })} />
      {old !== value && (typeof old === "string" || typeof old === "number") && <span className="block text-[11px] text-ink-3 mt-1">الأصل في الاستخراج: <bdi>{old}</bdi></span>}
    </Label>;
  };
  function reorder(group: TopicGroup, index: number, direction: number) {
    const items = [...course[group]]; const moved = items[index]; const target = items[index + direction];
    if (!moved || !target) return;
    items[index] = target; items[index + direction] = moved;
    onChange({ ...course, [group]: items.map((item, orderIndex) => ({ ...item, orderIndex })) });
  }
  function moveTopic(group: TopicGroup, index: number, target: TopicGroup) {
    if (group === target) return;
    const topic = course[group][index]; if (!topic) return;
    onChange({ ...course, [group]: course[group].filter((_, position) => position !== index).map((item, orderIndex) => ({ ...item, orderIndex })),
      [target]: [...course[target], { ...topic, orderIndex: course[target].length }] });
  }
  const tabs = [["basic", "البيانات الأساسية"], ["content", "محتوى المقرر"], ["outcomes", "مخرجات التعلم"], ["assessment", "خطة التقييم"], ["references", "المراجع"]];
  return <div className="min-w-0">
    <div className="mb-3 text-[12px]">
      {readiness.required.length > 0 && <p className="text-crim">مطلوب قبل الاعتماد: {readiness.required.join("، ")}. يمكنك حفظ المسودة الآن.</p>}
      {readiness.recommended.length > 0 && <p className="text-ink-3 mt-1">يمكن استكماله: {readiness.recommended.join("، ")}.</p>}
    </div>
    <div role="tablist" aria-label="أقسام التوصيف" className="flex flex-wrap gap-1 mb-4 border-b border-line pb-2">
      {tabs.map(([key, title]) => <button key={key} type="button" role="tab" aria-selected={section === key}
        aria-controls={`review-panel-${course.courseKey}`} onClick={() => setSection(key ?? "basic")}
        className={`px-3 py-2 min-h-11 rounded-lg text-[12.5px] ${section === key ? "bg-deep text-white" : "text-ink-3 hover:bg-paper"}`}>{title}</button>)}
    </div>
    <fieldset disabled={readOnly} id={`review-panel-${course.courseKey}`} className="min-w-0 space-y-4">
      {section === "basic" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {scalar("courseTitle", "اسم المقرر")}{scalar("courseCode", "رمز المقرر")}{scalar("creditHours", "الساعات المعتمدة", false, true)}
        <Label text="هل للمقرر معمل؟"><Select value={course.hasLab === null ? "" : String(course.hasLab)}
          onChange={(event) => onChange({ ...course, hasLab: event.target.value === "" ? null : event.target.value === "true" })}>
          <option value="">غير محدد</option><option value="true">نعم</option><option value="false">لا</option></Select></Label>
        {scalar("program", "البرنامج", true)}{scalar("track", "المسار", true)}{scalar("department", "القسم")}
        {scalar("level", "المستوى", true)}{scalar("year", "السنة")}
        <Label text="إجباري أم اختياري؟"><Select value={course.requiredOrElective ?? ""} onChange={(event) => onChange({ ...course,
          requiredOrElective: event.target.value === "REQUIRED" ? "REQUIRED" : event.target.value === "ELECTIVE" ? "ELECTIVE" : null })}>
          <option value="">غير محدد</option><option value="REQUIRED">إجباري</option><option value="ELECTIVE">اختياري</option></Select></Label>
      </div>}
      {section === "content" && <>
        <details className="border border-line rounded-lg p-3"><summary className="cursor-pointer text-[13px] font-medium">الوصف والأهداف والمتطلبات</summary>
          <div className="space-y-3 mt-3"><Label text="وصف المقرر"><Textarea value={course.description ?? ""} onChange={(event) => onChange({ ...course, description: event.target.value || null })} /></Label>
            {(["objectives", "prerequisites", "corequisites", "teachingStrategies"] as const).map((key, index) => <TextList key={key}
              label={["الأهداف", "المتطلبات السابقة", "المتطلبات المتزامنة", "استراتيجيات التدريس"][index] ?? key} values={course[key]} onChange={(values) => onChange({ ...course, [key]: values })} />)}
          </div></details>
        <p className="text-[12px] text-ink-3">راجع الفهرس وعدّل التفاصيل أو أضف موضوعًا. المواضيع التي لم يحدد الاستخراج نوعها تبقى غير مصنفة حتى تراجعها.</p>
        {TOPIC_GROUPS.map(([group, label]) => <section key={group} className="border border-line rounded-lg p-3">
          <h4 className="text-[13px] font-semibold mb-2">{label} · {formatNum(course[group].length)} موضوعًا</h4>
          <ol className="space-y-2">{course[group].map((topic, index) => <li key={topic.id} className="border border-line rounded-lg p-2">
            <div className="flex gap-1 items-start">
              <details className="min-w-0 flex-1"><summary className="cursor-pointer text-[13px] break-words">{formatNum(index + 1)}. {topic.title || "موضوع بلا عنوان"}</summary>
                <div className="space-y-2 mt-3"><Label text="عنوان الموضوع"><Input value={topic.title} onChange={(event) => onChange({ ...course,
                  [group]: course[group].map((item) => item.id === topic.id ? { ...item, title: event.target.value } : item) })} /></Label>
                  <TextList label="التفاصيل" values={topic.details} onChange={(details) => onChange({ ...course, [group]: course[group].map((item) => item.id === topic.id ? { ...item, details } : item) })} />
                  <div className="grid grid-cols-2 gap-2"><Label text="ساعات الاتصال"><Input type="number" min="0" step="any" value={topic.contactHours ?? ""}
                    onChange={(event) => onChange({ ...course, [group]: course[group].map((item) => item.id === topic.id ? { ...item, contactHours: event.target.value === "" ? null : Number(event.target.value) } : item) })} /></Label>
                    <Label text="نوع الموضوع"><Select value={group} onChange={(event) => moveTopic(group, index, event.target.value as TopicGroup)}>
                      {TOPIC_GROUPS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</Select></Label></div>
                  <TextList label="مخرجات التعلم المرتبطة" values={topic.learningOutcomes} onChange={(learningOutcomes) => onChange({ ...course,
                    [group]: course[group].map((item) => item.id === topic.id ? { ...item, learningOutcomes } : item) })} />
                </div></details>
              <Button type="button" size="sm" variant="text" aria-label={`تقديم الموضوع ${topic.title}`} disabled={index === 0} onClick={() => reorder(group, index, -1)}>↑</Button>
              <Button type="button" size="sm" variant="text" aria-label={`تأخير الموضوع ${topic.title}`} disabled={index === course[group].length - 1} onClick={() => reorder(group, index, 1)}>↓</Button>
              <Button type="button" size="sm" variant="text" aria-label={`حذف الموضوع ${topic.title}`} onClick={() => onChange({ ...course,
                [group]: course[group].filter((item) => item.id !== topic.id).map((item, orderIndex) => ({ ...item, orderIndex })) })}>حذف</Button>
            </div><SourcePages pages={topic.sourcePages} fileUrl={fileUrl} />
          </li>)}</ol>
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => onChange({ ...course, [group]: [...course[group],
            { id: humanId(), title: "", details: [], orderIndex: course[group].length, contactHours: null, learningOutcomes: [], sourcePages: [] }] })}>إضافة موضوع {label === "غير مصنف" ? "" : label}</Button>
        </section>)}
      </>}
      {section === "outcomes" && <>
        {course.learningOutcomes.map((outcome) => <details key={outcome.id} className="border border-line rounded-lg p-3">
          <summary className="cursor-pointer text-[13px]"><bdi>{outcome.code}</bdi> {outcome.text || "مخرج بلا نص"}</summary>
          <div className="space-y-2 mt-3"><div className="grid grid-cols-2 gap-2"><Label text="رمز المخرج"><Input value={outcome.code ?? ""} onChange={(event) => onChange({ ...course,
            learningOutcomes: course.learningOutcomes.map((item) => item.id === outcome.id ? { ...item, code: event.target.value || null } : item) })} /></Label>
            <Label text="المجال"><Input value={outcome.domain ?? ""} onChange={(event) => onChange({ ...course,
              learningOutcomes: course.learningOutcomes.map((item) => item.id === outcome.id ? { ...item, domain: event.target.value || null } : item) })} /></Label></div>
            <Label text="نص المخرج"><Textarea value={outcome.text} onChange={(event) => onChange({ ...course,
              learningOutcomes: course.learningOutcomes.map((item) => item.id === outcome.id ? { ...item, text: event.target.value } : item) })} /></Label>
            {(["alignedPloCodes", "teachingStrategies", "assessmentMethods"] as const).map((key, index) => <TextList key={key}
              label={["رموز مخرجات البرنامج المرتبطة", "استراتيجيات التدريس", "طرق التقييم"][index] ?? key} values={outcome[key]}
              onChange={(values) => onChange({ ...course, learningOutcomes: course.learningOutcomes.map((item) => item.id === outcome.id ? { ...item, [key]: values } : item) })} />)}
            <Button type="button" variant="text" size="sm" onClick={() => onChange({ ...course, learningOutcomes: course.learningOutcomes.filter((item) => item.id !== outcome.id) })}>حذف المخرج</Button>
          </div><SourcePages pages={outcome.sourcePages} fileUrl={fileUrl} />
        </details>)}
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ ...course, learningOutcomes: [...course.learningOutcomes,
          { id: humanId(), code: null, text: "", domain: null, alignedPloCodes: [], teachingStrategies: [], assessmentMethods: [], sourcePages: [] }] })}>إضافة مخرج تعلم</Button>
      </>}
      {section === "assessment" && <>
        <p className="text-[12px] text-ink-3">خطة التقييم الرسمية من التوصيف.</p>
        {course.assessmentPlan.map((item) => <div key={item.id} className="border border-line rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Label text="النشاط"><Input value={item.activity ?? ""} onChange={(event) => onChange({ ...course, assessmentPlan: course.assessmentPlan.map((row) => row.id === item.id ? { ...row, activity: event.target.value || null } : row) })} /></Label>
            <Label text="الأسبوع / الموعد"><Input value={item.week ?? ""} onChange={(event) => onChange({ ...course, assessmentPlan: course.assessmentPlan.map((row) => row.id === item.id ? { ...row, week: event.target.value || null } : row) })} /></Label>
            <Label text="النسبة %"><Input type="number" min="0" max="100" value={item.percentage ?? ""} onChange={(event) => onChange({ ...course, assessmentPlan: course.assessmentPlan.map((row) => row.id === item.id ? { ...row, percentage: event.target.value === "" ? null : Number(event.target.value) } : row) })} /></Label>
          </div><TextList label="رموز المخرجات المرتبطة" values={item.outcomeCodes} onChange={(outcomeCodes) => onChange({ ...course, assessmentPlan: course.assessmentPlan.map((row) => row.id === item.id ? { ...row, outcomeCodes } : row) })} />
          <SourcePages pages={item.sourcePages} fileUrl={fileUrl} /><Button type="button" variant="text" size="sm" onClick={() => onChange({ ...course, assessmentPlan: course.assessmentPlan.filter((row) => row.id !== item.id) })}>حذف النشاط</Button>
        </div>)}
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ ...course, assessmentPlan: [...course.assessmentPlan,
          { id: humanId(), activity: null, week: null, percentage: null, outcomeCodes: [], sourcePages: [] }] })}>إضافة نشاط تقييم</Button>
      </>}
      {section === "references" && REFERENCE_GROUPS.map(([group, label]) => <section key={group} className="border border-line rounded-lg p-3 space-y-2">
        <h4 className="text-[13px] font-semibold">{label}</h4>
        {course.references[group].map((item) => <div key={item.id} className="border border-line rounded-lg p-2 space-y-2">
          <Label text="المرجع"><Textarea value={item.citation} onChange={(event) => onChange({ ...course, references: { ...course.references,
            [group]: course.references[group].map((row) => row.id === item.id ? { ...row, citation: event.target.value } : row) } })} /></Label>
          <Label text="تصنيف المرجع"><Select value={group} onChange={(event) => { const target = event.target.value as ReferenceGroup;
            if (target !== group) onChange({ ...course, references: { ...course.references, [group]: course.references[group].filter((row) => row.id !== item.id),
              [target]: [...course.references[target], { ...item, type: target }] } }); }}>
            {REFERENCE_GROUPS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</Select></Label>
          <SourcePages pages={item.sourcePages} fileUrl={fileUrl} /><Button type="button" variant="text" size="sm" onClick={() => onChange({ ...course,
            references: { ...course.references, [group]: course.references[group].filter((row) => row.id !== item.id) } })}>حذف المرجع</Button>
        </div>)}
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange({ ...course, references: { ...course.references,
          [group]: [...course.references[group], { id: humanId(), citation: "", type: group, sourcePages: [] }] } })}>إضافة مرجع</Button>
      </section>)}
      <details className="border-t border-line pt-3"><summary className="cursor-pointer text-[13px] font-medium">معلومات إضافية — اختيارية</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {scalar("institution", "الجامعة")}{scalar("college", "الكلية")}{scalar("programCode", "رمز البرنامج")}{scalar("programVersion", "إصدار البرنامج")}
          {scalar("version", "إصدار توصيف المقرر")}{scalar("lastRevisionDate", "تاريخ آخر مراجعة")}{scalar("courseType", "نوع المقرر")}
          {scalar("nameAr", "الاسم بالعربية")}{scalar("nameEn", "الاسم بالإنجليزية")}
          {scalar("theoreticalHours", "الساعات النظرية", false, true)}{scalar("practicalHours", "الساعات العملية", false, true)}
          {(["facilities", "qualityAssessment", "specificationApproval"] as const).map((key, index) => <Label key={key}
            text={["التجهيزات", "تقويم الجودة", "تفاصيل اعتماد التوصيف في المصدر"][index]}><Textarea value={course[key] ?? ""} onChange={(event) => onChange({ ...course, [key]: event.target.value || null })} /></Label>)}
        </div>
      </details>
    </fieldset>
    <SourcePages pages={course.sourcePages} fileUrl={fileUrl} />
  </div>;
}
