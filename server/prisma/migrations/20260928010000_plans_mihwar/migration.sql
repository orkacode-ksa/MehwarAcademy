-- باقتان فقط: «محور» و«محور برو». لا باقة مجانية — تجربة ثم اشتراك.
-- الاشتراكات والطلبات تشير للباقة بمعرّفها لا برمزها، فإعادة التسمية لا تكسر أي ربط.
UPDATE "plans" SET "code" = 'MIHWAR', "nameAr" = 'محور', "sortOrder" = 1,
  "features" = ARRAY['مقررات بلا حد', 'ملف المقرر والجودة كاملًا', '١٠ جيجابايت تخزين', '٢٠ توليدًا شهريًا'],
  "updatedAt" = now()
  WHERE "code" = 'BASIC';
UPDATE "plans" SET "code" = 'MIHWAR_PRO', "nameAr" = 'محور برو', "sortOrder" = 2,
  "features" = ARRAY['كل ما في «محور»', '٥٠ جيجابايت تخزين', '٦٠ توليدًا شهريًا', '٥ مقررات جاهزة من البنك سنويًا'],
  "updatedAt" = now()
  WHERE "code" = 'VIP';
-- المجانية تُحذف إن لم يشر إليها شيء، وإلا تُعطَّل فلا تُعرض ولا تُشترى.
DELETE FROM "plans" p WHERE p."code" = 'FREE'
  AND NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."planId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."planId" = p."id");
UPDATE "plans" SET "active" = false WHERE "code" = 'FREE';

-- لا يُقفل أحد يوم النشر: كل تجربة انتهت (أو اشتراك بلا باقة) تُمدَّد ٣٠ يومًا من اليوم،
-- ويقرّر المالك بعدها من شاشته (تمديد · تفعيل · ترك).
UPDATE "subscriptions" SET "status" = 'TRIALING', "trialEndsAt" = now() + interval '30 days', "updatedAt" = now()
  WHERE ("status" = 'TRIALING' AND ("trialEndsAt" IS NULL OR "trialEndsAt" < now() + interval '30 days'))
     OR ("status" <> 'ACTIVE' AND "planId" IS NULL);
