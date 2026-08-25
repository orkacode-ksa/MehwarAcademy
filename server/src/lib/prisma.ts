import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

/** نسخة Prisma Client الوحيدة في العملية — لا تُنشئ نسخة ثانية أبدًا */
export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}

/** Soft delete: يُصفّي deletedAt=null تلقائيًا على القراءات لكل النماذج التي تحمل الحقل */
const SOFT_DELETE_MODELS = new Set([
  "User",
  "Workspace",
  "AcademicYear",
  "Semester",
  "Course",
  "Section",
  "Enrollment",
  "Topic",
  "Lecture",
  "Assessment",
  "FileAsset",
]);

export const prismaExtended = prisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (SOFT_DELETE_MODELS.has(model)) {
          args.where = { ...(args.where ?? {}), deletedAt: null };
        }
        return query(args);
      },
      async findFirst({ model, args, query }) {
        if (SOFT_DELETE_MODELS.has(model)) {
          args.where = { ...(args.where ?? {}), deletedAt: null };
        }
        return query(args);
      },
    },
  },
});
