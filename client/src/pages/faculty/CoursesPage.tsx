import { Link } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";

/**
 * مقرراتي — الشاشة الأولى بعد الدخول، وهي أيضًا الرئيسية. لا لوحة قبلها.
 *
 * في الإصدار الأول كانت هناك «لوحة» بأربع بطاقات مؤشرات وشبكة أدوات وتنبيهات وقائية
 * قبل الوصول إلى المقررات. المستخدم يدخل ليفتح مقرره، فالمقررات هي أول ما يراه.
 *
 * البيانات فارغة عمدًا حتى يُوصَل الخادم: الحالة الفارغة هي شاشة المستخدم الجديد
 * الحقيقية، وعرض مقررات وهمية كان أحد أسباب ارتباك العميل في الإصدار الأول.
 */

interface Course {
  id: string;
  code: string;
  name: string;
  studentCount: number;
}

const courses: Course[] = [];

export function CoursesPage() {
  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[21px] font-semibold">مقرراتي</h1>
        <button
          className="inline-flex items-center gap-2 bg-deep text-white text-[13.5px] font-medium
                     px-4 py-2.5 rounded-[11px] min-h-[44px] shadow-s1
                     hover:bg-deep2 transition-colors"
        >
          <Icon name="plus" className="w-[15px] h-[15px]" />
          مقرر جديد
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20 px-6">
          <p className="text-[15px] text-ink2">لم تُضِف مقرراً بعد.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                to={`/courses/${course.id}`}
                className="flex items-center justify-between gap-4 bg-white border border-line rounded-[14px]
                           px-4 py-4 min-h-[68px] hover:border-[#C6D3CB] hover:shadow-s1 transition-all"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] truncate">{course.name}</div>
                  <div className="text-[12.5px] text-ink3-text mt-0.5">
                    {course.code} · {course.studentCount} طالباً
                  </div>
                </div>
                <Icon name="arrl" className="w-4 h-4 text-ink3-text flex-none" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
