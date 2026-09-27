# أتمتة التوليد — n8n

الملف `mihwar-generation.workflow.json` سير عمل جاهز للاستيراد. مِحوَر يرسل المهمة، وn8n يولّد ويرفع إلى R2، ثم يعيد النتيجة موقّعة.

```
مِحوَر ──(POST موقّع HMAC)──▶ Webhook ─▶ تحقّق التوقيع ─▶ بناء الموجّه ─▶ Gemini (نص)
                                                                      │
                          ┌──────────── حسب النوع ────────────────────┤
                          ▼                    ▼                      ▼
                    شرح / شرائح         بودكاست: Gemini TTS       فيديو: Veo
                     (نص فقط)           ← ffmpeg mp3 ← رفع R2    ← انتظار ← رفع R2
                          └──────────────▶ توقيع النتيجة ─▶ Callback إلى مِحوَر
```

## التشغيل

1. **استضافة n8n ذاتيًا** (مثلًا خدمة Docker في مشروع Railway نفسه، من قالب n8n الرسمي).
   البودكاست يحتاج `ffmpeg` داخل الحاوية. إن لم يكن موجودًا في الصورة، ابنِ صورة صغيرة فوقها:
   `FROM n8nio/n8n` ثم `USER root` ثم `RUN apk add --no-cache ffmpeg` ثم `USER node`.
2. متغيّرات بيئة n8n:

| المتغيّر | القيمة |
|---|---|
| `MIHWAR_SHARED_SECRET` | نفس `N8N_SHARED_SECRET` في خادم مِحوَر |
| `GEMINI_API_KEY` | مفتاح Google AI Studio (طبقة مدفوعة — الطبقة المجانية مرفوضة لبيانات المستأجرين) |
| `GEMINI_TEXT_MODEL` | نموذج النص الحالي من وثائق Gemini |
| `GEMINI_TTS_MODEL` | نموذج تحويل النص إلى كلام الذي يدعم متحدثَين |
| `VEO_MODEL` | نموذج Veo للفيديو (اختياري — مكلف) |
| `NODE_FUNCTION_ALLOW_BUILTIN` | `child_process,fs,crypto` |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` |

3. **Workflows ← Import from file** ← اختر الملف، ثم **Activate**.
4. انسخ «Production URL» لعقدة Webhook، وضعه في خادم مِحوَر في `N8N_WEBHOOK_URL`.

## العقد بين الطرفين

- **الطلب إلى n8n:** يتضمّن الحقول:
  - `jobId`, `tenantId`, `kind` (TEXT|SLIDES|AUDIO|VIDEO), `topicTitle`, `sourcePack`، وهي مواد الموضوع كنص؛
  - `upload`: رابط PUT موقّع إلى R2، صالح ساعة، وتكون قيمته `null` في النص؛
  - `google.accessToken`: موجود إن ربط الأستاذ حسابه، ويُستخدم لـ NotebookLM Enterprise أو Drive؛
  - `callbackUrl`.
- **التوقيع في الاتجاهين:**
  - الترويسة `X-Mihwar-Signature` تساوي `hex(HMAC-SHA256(secret, "${X-Mihwar-Timestamp}.${body}"))`؛
  - يُرفض أي طلب يختلف طابعه الزمني أكثر من ١٠ دقائق.
- **الرد (Callback):**
  - `{ jobId, tenantId, status: "SUCCEEDED"|"FAILED", result?: { title, text? | objectKey, sizeBytes, mimeType }, error? }`؛
  - يجب أن يبدأ `objectKey` بالمسار الذي أُعطي في `upload`، وإلا يُرفض؛
  - الاستدعاء المكرّر لا يُنشئ مادة ثانية.
- النتيجة تظهر للأستاذ مادةً جديدة في الموضوع، والملف محسوب من حصة تخزينه.

## بديل NotebookLM Enterprise
عند توفّره لحساب الأستاذ أو جامعته، يمكن استبدال عقدتي Gemini بطلب HTTP إلى واجهة NotebookLM Enterprise مع الترويسة
`Authorization: Bearer {{$json.body.google.accessToken}}`. يبقى باقي سير العمل كما هو: الرفع والتوقيع والرد.
