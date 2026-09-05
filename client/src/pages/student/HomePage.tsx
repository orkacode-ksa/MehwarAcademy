import { Link } from "react-router-dom";
import { SectionLabel } from "../../components/shared/Section.js";
import { StudentCourseCard } from "../../components/student/StudentCourseCard.js";
import { AttendanceCodeCard } from "../../components/student/AttendanceCodeCard.js";
import { QuizBanner } from "../../components/student/QuizBanner.js";
import { Surface } from "../../components/ui/Surface.js";
import { Alert } from "../../components/ui/Alert.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { todayName } from "../../mock/courseData.js";
import { ABSENCE_LIMIT, nextSession, openDeliverables, openQuiz, studentAgenda, studentCourses } from "../../mock/student.js";
import { formatNum } from "../../lib/numerals.js";

/**
 * لوحة الطالب — «ماذا عليّ الآن» بترتيب الإلحاح: اختبار مفتوح، ثم تسجيل حضور جلسة
 * جارية، ثم المستحق، ثم جدول اليوم، ثم المقررات. ثلاث نقرات كحد أقصى لأي شيء.
 */
export function StudentHomePage() {
  const courses = studentCourses();
  const quiz = openQuiz();
  const day = todayName();
  const agenda = studentAgenda(day);
  const upcoming = nextSession();
  const due = openDeliverables();
  const atRisk = courses.filter((c) => c.attendance.absenceRate >= ABSENCE_LIMIT - 8);

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {quiz && <QuizBanner quiz={quiz} />}
      {upcoming && <AttendanceCodeCard session={upcoming.session} live={upcoming.live} today={upcoming.today} day={upcoming.day} />}

      {atRisk.map((c) => (
        <Alert key={c.course.id} tone="amber" icon="alert" title={`تنبيه بشأن حضورك في ${c.course.code}`}>
          بلغت نسبة غيابك {formatNum(c.attendance.absenceRate)}٪ والحد النظامي {formatNum(ABSENCE_LIMIT)}٪. يتبقّى لك{" "}
          {formatNum(c.attendance.remainingBeforeLimit)} محاضرات قبل بلوغ الحد.
        </Alert>
      ))}

      <section className="min-w-0">
        <SectionLabel icon="pen" action={<Link to="/sdates" className="text-[11.5px] font-semibold text-deep">كل المواعيد ←</Link>}>
          المستحق عليك
        </SectionLabel>
        {due.length === 0 ? (
          <Surface variant="card" pad className="text-center text-[12.5px] text-ink-2">لا تسليمات مفتوحة الآن.</Surface>
        ) : (
          <div className="grid gap-2 [&>*]:min-w-0">
            {due.map((d) => (
              <Link
                key={`${d.courseId}-${d.title}`}
                to={`/scourse/${d.courseId}/sgr`}
                className="flex items-center gap-3 p-3 sm:p-3.5 rounded-rmd bg-white border border-line hover:border-[#C6D3CB] hover:shadow-s2 transition-[border-color,box-shadow]"
              >
                <span className="w-9 h-9 rounded-[11px] grid place-items-center flex-none bg-gold2/[.18] text-[#7C6134]">
                  <Icon name={d.kind === "بحث" ? "file" : d.kind === "نشاط" ? "users" : "pen"} className="w-[17px] h-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">{d.title}</span>
                  <span className="block text-[11px] text-ink-3">{d.code}</span>
                </span>
                <Chip tone="amber">{d.due}</Chip>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="min-w-0">
        <SectionLabel icon="cal">محاضراتك اليوم — {day}</SectionLabel>
        {agenda.length === 0 ? (
          <Surface variant="card" pad className="text-center text-[12.5px] text-ink-2">لا محاضرات لك اليوم.</Surface>
        ) : (
          <div className="grid gap-2 [&>*]:min-w-0">
            {agenda.map((s) => (
              <Link
                key={s.courseId}
                to={`/scourse/${s.courseId}`}
                className="flex items-center gap-3 p-3 sm:p-3.5 rounded-rmd bg-white border border-line hover:border-[#C6D3CB] hover:shadow-s2 transition-[border-color,box-shadow]"
              >
                <span className="num text-[13px] font-semibold text-deep flex-none w-[52px]">{s.clock}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">{s.name}</span>
                  <span className="block text-[11px] text-ink-3">
                    {s.code} · {s.room}
                  </span>
                </span>
                <Chip tone="neutral">{s.kind}</Chip>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="min-w-0">
        <SectionLabel icon="book" action={<Link to="/scourses" className="text-[11.5px] font-semibold text-deep">كل مقرراتي ←</Link>}>
          مقرراتي
        </SectionLabel>
        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3 gap-4">
          {courses.slice(0, 3).map((c) => (
            <StudentCourseCard key={c.course.id} item={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
