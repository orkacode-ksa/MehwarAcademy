# نظام التصميم — مستخرَج من `mihwar-prototype-v2.html`

هذا الملف مرجع الاستخراج، لا المصدر — البروتوتايب هو المواصفة. أي خلاف بين هذا الملف والبروتوتايب، البروتوتايب يسود.

## الرموز (`:root`) — منسوخة حرفيًا

```css
--canvas:#F3F5F3; --surface:#FFFFFF;
--glass:rgba(255,255,255,.72); --glass-br:rgba(255,255,255,.6);
--deep:#0F4739; --deep2:#145A48; --deep3:#1A6B57;
--teal:#3E8E6E; --gold:#B0895A; --gold2:#C79A4B; --gold3:#E4C892;
--amber:#C79A4B; --crim:#C0544A;
--ink:#12241E; --ink2:#4A5A53; --ink3:#7E8C85;
--line:#DFE4DF; --line2:#EAEEEA;
--mint:#DCEAE3; --lav:#EFE7DA; --peach:#F5E9D8; --sky:#E4EDE8;
--rlg:24px; --rmd:16px; --rsm:8px;
--s1:0 2px 8px rgba(15,71,57,.06);
--s2:0 8px 24px rgba(15,71,57,.09);
--s3:0 18px 50px rgba(15,71,57,.13);
--rail:84px;
```

## الخطوط
| الخط | الاستخدام | القيد |
|---|---|---|
| Amiri 700 (وأحيانًا 400) | `h1`, `h2`, `.dsp`، شعار، عناوين الأقسام، الأرقام الكبيرة في صفحة الهبوط | **ممنوع تحت 18px** — خط نسخي كتابي |
| IBM Plex Sans Arabic 300–700 | `h3-h5`، كل نص واجهة وأزرار وصفوف | لا قيد |
| IBM Plex Mono 400–600 | كل رقم في جدول/درجة/إحصاء (`.num`) | `font-variant-numeric: tabular-nums` |

محمّلة محليًا (`@font-face` + woff2 + `font-display:swap`) — لا شبكة خارجية وقت التشغيل.

## السطحان
| السطح | الفئة | القواعد |
|---|---|---|
| الطمأنينة | `.glass` | `background:var(--glass)` + `backdrop-filter:blur(14px)` + `border:1px solid var(--glass-br)` + `border-radius:var(--rlg)` |
| العمل | `.work` | مسطّح: `background:#fff` + `border:1px solid var(--line)` + `border-radius:var(--rsm)` |
| بطاقة عادية | `.card` | `background:#fff` + `border` + `border-radius:var(--rlg)` + `box-shadow:var(--s1)` |

تلوينات البطاقات: `.tint-mint/.tint-lav/.tint-peach/.tint-sky` (تدرّج 155deg من اللون إلى أبيض شبه كامل).

## الذرّات الأساسية
- **أزرار** `.btn` + `.bp` (أساسي `--deep`), `.bg2` (ثانوي زجاجي), `.bt` (نصّي), `.bteal`, `.bgold` (هبوط فقط), `.bghost` (هبوط فقط) — أحجام `.bs` (صغير) / (افتراضي) / `.blg` (كبير)
- **شرائح** `.chip` + `.ct` (تركوازي/نجاح), `.ca` (كهرماني/تنبيه), `.cc` (قرمزي/خطر), `.cs` (محايد)
- **تنبيهات** `.alert` + `.aa` (كهرماني), `.at` (تركوازي), `.ac` (قرمزي) — أيقونة + عنوان + نص
- **حلقة المقرر** `ring(syl, q, as, size)`: قوس خارجي نصف قطره 46 (من 120 viewBox) بلون `--deep` = نسبة المنهج؛ قوس داخلي نصف قطره 35 بلون `--gold` = q/11؛ نقاط حول نصف قطر 56 لكل تقييم (ممتلئة ذهبي/فارغة محددة)؛ نص مركزي بخط Mono يتناسب حجمه مع `size`
- **جدول** `.tbl` مع `.tw` (حاوية تمرير أفقي تُضاف تلقائيًا لأي `table.tbl` غير داخل `.scroll`)، `.n`/`.id` أعمدة رقمية Mono، `.tot` عمود المجموع مظلَّل
- **KPI** `.kpi` (بطاقة رقم كبير + تسمية + سباركلاين اختياري)، `.stat` (داخل شريط `.stats` بفواصل عمودية)
- **صف قائمة** `.lrow` (أيقونة مربعة `.lic` بحالة ok/no/na/er + عنوان + وصف)
- **خطوة رحلة** `.jstep` بحالات done/now/lock، مع دائرة رقم `.jn` وشريط تقدّم `.jbar`
- **خطوة خط إنتاج** `.step` بحالات done/gate/wait

## جرد الشاشات (٢٩ + ١٣ تبويبًا)

**عام:** `landing` · `signup` (3 خطوات) · `login`

**عضو هيئة التدريس (10):** `home` `courses` `course` `studio` `attend` `office` `bank` `rules` `evalp` `archive` `settings` `exambuild`
(ملاحظة: `course` صفحة حاوية بـ 9 تبويبات `CT.*`: `overview sections general lectures lab tasks exams grades quality`)

**الطالب (7) — بُنيت في المرحلة ٥:** `shome` `scourses` `scourse` (تبويبات `SCT.*`: `slect smat sgr satt`) `sgrades` `sdates` `sbook` `squiz`

**رئيس القسم (4):** `dhome` `dmembers` `dquality` `dresults`

**مالك المنصة (6):** `biz` `cal` `users` `subs` `ai` `ops`

## البيانات الوهمية في البروتوتايب (`COURSES`, `STUD`, `JOURNEY`, `QUAL`, `PIPE`, `FIND`, إشعارات)
تُستبدل بالكامل ببيانات حقيقية من الخادم حسب القسم ٩ من برومت إعادة البناء؛ الشكل (المفاتيح والأنواع) هو المرجع لتصميم مخططات zod.

## الأيقونات
مجموعة `I.*` في البروتوتايب: `logo grid book tbl shield star cap chart cal users box clock check chk alert file play mic arr arrl plus down up bolt flask edit arch lock gear card pen sparks` — مسارات SVG منسوخة حرفيًا إلى مكوّنات React مقابلة (`viewBox="0 0 24 24"`, `stroke-width="1.8"`).

## الحركة
- الهبوط: صعود متتابع (`animation-delay` 0.05s خطوات)، كشف عند التمرير عبر `IntersectionObserver` بعتبة 0.14
- داخل المنصة: انتقالات < 200ms، لا حركة في سطح العمل
- `@media(prefers-reduced-motion:reduce)` يعطّل كل حركة — إلزامي وموروث من البروتوتايب نفسه

## قواعد الاستجابة (من البروتوتايب مباشرة، جميعها "أخطاء وقعت وصُحِّحت")
انظر القسم ٦ من برومت إعادة البناء — منقولة حرفيًا لملف `client/src/styles/global.css` كتعليقات مرجعية عند التطبيق.

## الأرقام (بعد المرحلة ٥)
نظام `latn` في كل الشاشات والمستندات، وفق دستور الهندسة ٤٫٣. كانت الواجهة تخلط
الأرقام الهندية في السرد باللاتينية في الجداول، حتى ظهر الرقم الواحد بصيغتين في
شاشتين. الدالة الوحيدة `lib/numerals.ts#formatNum` تبني على `Intl.NumberFormat`.

**قاعدتان تُطبَّقان مع الأرقام في نص عربي:**
- لا خط أحادي المسافة على نص عربي — IBM Plex Mono بلا محارف عربية، فيتباعد النص.
- الرقم ذو الإشارة (`+6`) داخل `dir="ltr"`، وإلا انتقلت الإشارة بصريًا إلى آخره.
- الكسر بين عددين يُكتب «0 من 8» لا «0 / 8»: الشرطة المائلة يُعاد ترتيبها في RTL.

## الجداول
`components/shared/DataTable.tsx` — جدول على ≥768 بكسل وبطاقات دونها، بمكوّن واحد
يُرسم أحد وضعيه لا كلاهما. مطلوب بدستور الهندسة ٤٫٣، ويعلو على البروتوتايب الذي
كان يعتمد التمرير الأفقي وحده.
