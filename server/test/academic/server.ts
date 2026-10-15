// Test harness only: the real application, without AI workers or development admissions.
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prismaBase } from "../../src/lib/prisma.js";
import { assertRlsEffective } from "../../src/lib/rlsGuard.js";
import { installArabicZodErrorMap } from "@mihwar/shared";

const database = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "test" || database.hostname !== "127.0.0.1" || !database.pathname.startsWith("/mihwar_academic_test_")) throw new Error("An isolated automated test database is required");
installArabicZodErrorMap();
await assertRlsEffective();
const server = createApp().listen(env.PORT, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => { void prismaBase.$disconnect().finally(() => process.exit(0)); }));
