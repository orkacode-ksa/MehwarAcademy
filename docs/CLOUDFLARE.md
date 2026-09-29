# وضع Cloudflare أمام المنصة

الخادم جاهز: متى ضُبط `CF_ORIGIN_SECRET` يرفض كل طلب API لا يحمل ترويسة السر (فيصير رابط
`*.up.railway.app` المباشر عديم الفائدة للمهاجم)، ويأخذ عنوان المستخدم الحقيقي من
`CF-Connecting-IP` لحدود المعدّل. فحص الصحة `/healthz` خارج هذا الشرط فلا يتعطّل النشر.

## الخطوات (مرة واحدة — من حسابك في Cloudflare وRailway)

1. **النطاق**: اختر عنوان المنصة، مثل `app.orkacode.sa`.
2. **Railway ← mihwar-client ← Settings ← Networking ← Custom Domain**: أضف `app.orkacode.sa`،
   وانسخ قيمة CNAME التي يعطيها.
3. **Cloudflare ← DNS**: سجل `CNAME` باسم `app` إلى القيمة المنسوخة، **Proxied (السحابة البرتقالية)**.
4. **Cloudflare ← SSL/TLS**: الوضع **Full (strict)**، وفعّل Always Use HTTPS.
5. **السر**: ولّد قيمة عشوائية طويلة (مثلًا `openssl rand -hex 32`).
   - **Cloudflare ← Rules ← Transform Rules ← Modify Request Header**: لكل الطلبات إلى
     `app.orkacode.sa` ← Set static ← `X-Origin-Auth` = السر.
   - **Railway ← mihwar-server ← Variables**: `CF_ORIGIN_SECRET` = السر نفسه.
6. **Railway ← mihwar-server ← Variables**: `APP_URL=https://app.orkacode.sa` وأضف النطاق إلى
   `CLIENT_ORIGINS` و`API_ORIGIN`.
7. **الحماية**:
   - Security ← Bots: Bot Fight Mode.
   - Security ← WAF ← Rate limiting: `/api/auth/*` — 30 طلبًا/دقيقة لكل IP (طبقة قبل حدود الخادم).
   - Caching ← Cache Rules: `/assets/*` Cache Everything مع Edge TTL شهر (الملفات بأسماء مُجزّأة).

بعد الخطوة ٥ مباشرة: افتح المنصة من النطاق الجديد وتأكد أن الدخول يعمل، ثم جرّب
`https://mihwar-client-production.up.railway.app/api/public/offer` — يجب أن يعيد 403.
