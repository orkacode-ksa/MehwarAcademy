import { useEffect, useState } from "react";
import { ACTIVITY_TYPES, facultyActivitySchema, facultyProfileSchema, type ActivityType, type FacultyProfile } from "@mihwar/shared";
import { api, ApiError, pdfDownloadUrl } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { useSession } from "../../hooks/useSession.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, IconButton, Input, Label, Select, Textarea } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

interface Activity { id: string; type: ActivityType; title: string; venue: string | null; date: string; hours: number | null; participation: string | null }
interface Data { fullName: string; email: string; profile: Partial<FacultyProfile>; activities: Activity[] }

const RANKS = ["معيد", "محاضر", "أستاذ مساعد", "أستاذ مشارك", "أستاذ"];

/** سيرتي — بيانات ثابتة مرة، ونشاط يُضاف كلما حدث؛ والسيرة PDF بنقرة. */
export function CvPage() {
  const { data, reload } = useApi<Data>("/profile");
  const sug = useApi<{ departments: string[]; colleges: string[] }>("/profile/suggestions");
  const { user } = useSession();
  const [p, setP] = useState<FacultyProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (data) setP(facultyProfileSchema.parse(data.profile ?? {}));
  }, [data]);
  if (!data || !p) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;

  async function save() {
    try {
      await api.put("/profile", p);
      showToast("حُفظت بياناتك");
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    }
  }
  const field = (k: keyof FacultyProfile, label: string, long = false, list?: string) => (
    <Label text={label}>
      {long ? (
        <Textarea rows={3} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
      ) : (
        <Input value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} list={list} />
      )}
    </Label>
  );

  return (
    <>
      <PageHeader
        title="سيرتي"
        description={data.fullName}
        actions={
          <a href={pdfDownloadUrl("/profile/cv.pdf")}>
            <Button variant="primary">
              <Icon name="file" /> السيرة PDF
            </Button>
          </a>
        }
      />
      <Card title="البيانات الأساسية" hint="الرتبة والتخصص يكفيان لتكتمل «السيرة الذاتية» في ملفات مقرراتك.">
        <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Label text="الرتبة العلمية">
            <Select value={p.rank} onChange={(e) => setP({ ...p, rank: e.target.value })}>
              <option value="">اختر</option>
              {[...RANKS, ...(p.rank && !RANKS.includes(p.rank) ? [p.rank] : [])].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Label>
          {field("specialization", "التخصص")}
          {field("department", "القسم", false, "cv-departments")}
          {field("college", "الكلية", false, "cv-colleges")}
          {/* ما كتبه الزملاء في الجامعة نفسها — اختيار لا كتابة */}
          <datalist id="cv-departments">{sug.data?.departments.map((d) => <option key={d} value={d} />)}</datalist>
          <datalist id="cv-colleges">{sug.data?.colleges.map((d) => <option key={d} value={d} />)}</datalist>
        </div>
        <div className="grid gap-3 mt-3">
          {field("qualifications", "المؤهلات العلمية", true)}
          {field("bio", "نبذة", true)}
        </div>
        <ErrorText>{err}</ErrorText>
        <Button variant="primary" className="mt-3" onClick={() => void save()}>
          <Icon name="chk" /> احفظ
        </Button>
      </Card>

      <Activities items={data.activities} onChanged={reload} />

      {user?.isDeptHead && (
        <Card title="التقرير السنوي للقسم" className="mt-4" hint="الأبحاث والندوات والدورات التي سجّلها أعضاء القسم هذا العام — بنموذج الجامعة.">
          <a href={pdfDownloadUrl("/profile/annual-report.pdf")}>
            <Button variant="secondary">
              <Icon name="file" /> التقرير السنوي PDF
            </Button>
          </a>
        </Card>
      )}
    </>
  );
}

function Activities({ items, onChanged }: { items: Activity[]; onChanged: () => void }) {
  const [f, setF] = useState({ type: "RESEARCH" as ActivityType, title: "", venue: "", date: new Date().toISOString().slice(0, 10), hours: "", participation: "" });
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    const parsed = facultyActivitySchema.safeParse({
      type: f.type,
      title: f.title,
      date: f.date,
      ...(f.venue ? { venue: f.venue } : {}),
      ...(f.hours ? { hours: Number(f.hours) } : {}),
      ...(f.participation ? { participation: f.participation } : {}),
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
    setErr(null);
    await api.post("/profile/activities", parsed.data);
    setF({ ...f, title: "", venue: "", hours: "", participation: "" });
    onChanged();
  }

  return (
    <Card title="النشاط العلمي" className="mt-4" hint="الأبحاث والمؤتمرات والدورات والورش — تظهر في سيرتك وفي تقرير القسم السنوي.">
      <ul className="grid gap-2 mb-4">
        {items.length === 0 && <li className="text-[13px] text-ink-3">لا نشاط مسجّل بعد.</li>}
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-2 border border-line2 rounded-[10px] px-3 py-2">
            <Chip>{ACTIVITY_TYPES[a.type]}</Chip>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] truncate">{a.title}</span>
              <span className="block text-[11.5px] text-ink-3">
                {a.venue ? `${a.venue} · ` : ""}
                {a.date.slice(0, 10)}
              </span>
            </span>
            <IconButton label={`حذف ${a.title}`} onClick={() => void api.del(`/profile/activities/${a.id}`).then(onChanged)}>
              <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
            </IconButton>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Label text="النوع">
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ActivityType })}>
            {(Object.keys(ACTIVITY_TYPES) as ActivityType[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_TYPES[k]}
              </option>
            ))}
          </Select>
        </Label>
        <Label text="العنوان">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Label>
        <Label text={f.type === "RESEARCH" ? "جهة النشر" : f.type === "CONFERENCE" ? "مكان الانعقاد" : "جهة التنفيذ"}>
          <Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} />
        </Label>
        <Label text="التاريخ">
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} dir="ltr" />
        </Label>
        {(f.type === "TRAINING" || f.type === "WORKSHOP") && (
          <Label text="عدد الساعات">
            <Input type="number" min={0} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
          </Label>
        )}
        {f.type !== "RESEARCH" && (
          <Label text="نوع المشاركة">
            <Input value={f.participation} onChange={(e) => setF({ ...f, participation: e.target.value })} placeholder={f.type === "CONFERENCE" ? "حضور / ورقة بحثية" : "حضور / مدرب"} />
          </Label>
        )}
      </div>
      <ErrorText>{err}</ErrorText>
      <Button variant="secondary" className="mt-3" onClick={() => void add()}>
        <Icon name="plus" /> أضف
      </Button>
    </Card>
  );
}
