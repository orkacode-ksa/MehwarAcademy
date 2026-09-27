import { useState } from "react";
import { rosterRowSchema, type RosterRow } from "@mihwar/shared";
import { api, ApiError } from "../../api/client.js";
import { Button } from "../ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

/**
 * استيراد كشف الطلاب.
 *
 * التحليل يجري **في المتصفّح** والأستاذ يرى الصفوف قبل حفظها. رفع ملف يُحفَظ مباشرة
 * يعني اكتشاف الخطأ بعد وقوعه — وكشوف الجامعات تأتي بأعمدة وترتيبات لا حصر لها.
 *
 * الأعمدة تُلتقط بأسماء عربية وإنجليزية شائعة، وما لم يُلتقط يظهر كصفوف مرفوضة
 * **برقم سطرها وسببها** لا كصمت: الأستاذ يفتح ملفه ويصلح السطر بعينه.
 */

const ID_KEYS = ["الرقم الجامعي", "رقم الطالب", "الرقم", "id", "student id", "university id"];
const NAME_KEYS = ["الاسم", "اسم الطالب", "name", "student name", "full name"];
const EMAIL_KEYS = ["البريد", "البريد الإلكتروني", "email", "e-mail"];

function pick(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const [k, v] of Object.entries(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.some((c) => norm === c || norm.includes(c))) {
      const value = String(v ?? "").trim();
      if (value) return value;
    }
  }
  return undefined;
}

interface Parsed {
  ok: RosterRow[];
  rejected: { line: number; reason: string }[];
}

export function RosterImport({ sectionId, onImported }: { sectionId: string; onImported: () => void }) {
  const { showToast } = useToast();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function readFile(file: File) {
    setErr(null);
    try {
      // CSV يُقرأ نصًّا: قراءته بايتات تفكّه Latin-1 فتصير العناوين العربية رموزًا مشوّهة
      // («Ø§ÙØ±ÙÙ») ويُرفض كل سطر «هذا الحقل مطلوب» — التقطه الفحص في متصفّح حقيقي.
      const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
      // قارئ Excel (~١٠٠ كيلوبايت) يُحمَّل عند اختيار الملف فقط، لا مع شاشة التجهيز.
      const XLSX = await import("xlsx");
      const wb = isCsv ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const first = wb.SheetNames[0];
      const sheet = first ? wb.Sheets[first] : undefined;
      if (!sheet) {
        setErr("الملف لا يحتوي على أي ورقة بيانات");
        return;
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const ok: RosterRow[] = [];
      const rejected: Parsed["rejected"] = [];
      rows.forEach((r, i) => {
        const res = rosterRowSchema.safeParse({
          universityIdNumber: pick(r, ID_KEYS),
          fullName: pick(r, NAME_KEYS),
          email: pick(r, EMAIL_KEYS),
        });
        if (res.success) ok.push(res.data);
        // +2: صف العناوين ثم الترقيم من واحد — ليطابق ما يراه في Excel تمامًا
        else rejected.push({ line: i + 2, reason: res.error.issues[0]?.message ?? "صف غير صالح" });
      });

      setFileName(file.name);
      setParsed({ ok, rejected });
    } catch {
      setErr("تعذّرت قراءة الملف — تأكّد أنه Excel أو CSV");
    }
  }

  async function commit() {
    if (!parsed?.ok.length) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<{ added: number; existing: number }>(
        "/workspaces/me/academic/roster/import",
        { sectionId, rows: parsed.ok },
      );
      setParsed(null);
      setFileName("");
      onImported();
      // تقرير بالنتيجة لا صمت: «حُفظ» وحدها لا تقول إن نصف الكشف كان مسجَّلًا من قبل.
      showToast(
        res.existing > 0
          ? `أُضيف ${formatNum(res.added)} · ${formatNum(res.existing)} مسجَّل من قبل`
          : `أُضيف ${formatNum(res.added)} طالباً`,
      );
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "تعذّر الاستيراد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <label className="inline-flex items-center gap-2 cursor-pointer text-[13px] text-deep font-medium border border-line rounded-[10px] px-3.5 py-2.5 bg-surface hover:border-line-strong min-h-[44px]">
        <Icon name="file" className="w-4 h-4" />
        {fileName || "ارفع كشف الطلاب (Excel أو CSV)"}
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
          }}
        />
      </label>

      {err && <p className="text-[12px] text-crim mt-2">{err}</p>}

      {parsed && (
        <div className="mt-3 border border-line rounded-[12px] overflow-hidden">
          <div className="px-3.5 py-2.5 bg-canvas border-b border-line text-[12.5px] flex items-center justify-between gap-3 flex-wrap">
            <span>
              صالح: <b className="text-teal">{formatNum(parsed.ok.length)}</b>
              {parsed.rejected.length > 0 && (
                <> · مرفوض: <b className="text-crim">{formatNum(parsed.rejected.length)}</b></>
              )}
            </span>
            <span className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => void commit()} disabled={busy || parsed.ok.length === 0}>
                استورد {formatNum(parsed.ok.length)}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setParsed(null)}>إلغاء</Button>
            </span>
          </div>

          <div className="max-h-[220px] overflow-y-auto">
            <ul className="divide-y divide-line2">
              {parsed.ok.slice(0, 50).map((r) => (
                <li key={r.universityIdNumber} className="flex items-center gap-3 px-3.5 py-2 text-[13px]">
                  <span className="text-ink-3 flex-none" dir="ltr">{r.universityIdNumber}</span>
                  <span className="flex-1 min-w-0 truncate">{r.fullName}</span>
                </li>
              ))}
            </ul>
            {parsed.rejected.length > 0 && (
              <ul className="divide-y divide-line2 border-t border-line">
                {parsed.rejected.slice(0, 10).map((r) => (
                  <li key={r.line} className="px-3.5 py-2 text-[12.5px] text-crim">
                    السطر {formatNum(r.line)}: {r.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
