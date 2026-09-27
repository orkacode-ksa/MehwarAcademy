#!/bin/sh
# إقلاع الخادم — ثلاث خطوات بترتيب لا يُعكس:
#
# ١) الهجرات بالدور المالك لقاعدة البيانات (MIGRATION_DATABASE_URL): إنشاء الجداول والسياسات
#    يحتاج صلاحيات لا يجوز أن يحملها التطبيق.
# ٢) تفعيل دخول دور التطبيق `mihwar_app` بكلمة مروره (APP_DB_PASSWORD) — الهجرة تُنشئه بلا
#    دخول عمدًا، ولا كلمة مرور في الريبو.
# ٣) تشغيل التطبيق بـ DATABASE_URL المشير إلى `mihwar_app`: غير خارق، فتسري عليه سياسات RLS.
#    حارس الإقلاع (rlsGuard) يرفض التشغيل في الإنتاج بدور خارق.
#
# بدون MIGRATION_DATABASE_URL يُستعمل DATABASE_URL للخطوتين — سلوك التطوير المحلي.
set -e

MIG_URL="${MIGRATION_DATABASE_URL:-$DATABASE_URL}"
SCHEMA=./prisma/schema.prisma

# هجرة التأجير فشلت على الإنتاج (مُطلِق سجل التدقيق) وبقيت «فاشلة» في سجل Prisma فأوقفت كل
# هجرة بعدها (P3009). الفشل كان ذرّيًا — لم يُطبَّق منها شيء — فتعليمها «متراجَعًا عنها» آمن
# ويعيد تطبيقها بنسختها المُصلَحة. إن لم تكن فاشلة يرفض Prisma الأمر فيُتجاهل.
DATABASE_URL="$MIG_URL" npx prisma migrate resolve --rolled-back 20260906000000_tenancy_foundation --schema=$SCHEMA >/dev/null 2>&1 || true

DATABASE_URL="$MIG_URL" npx prisma migrate deploy --schema=$SCHEMA

if [ -n "$APP_DB_PASSWORD" ]; then
  ESCAPED=$(printf "%s" "$APP_DB_PASSWORD" | sed "s/'/''/g")
  printf "ALTER ROLE mihwar_app LOGIN PASSWORD '%s';" "$ESCAPED" \
    | npx prisma db execute --stdin --url "$MIG_URL" >/dev/null
fi

exec node dist/index.js
