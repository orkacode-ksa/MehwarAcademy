import { Router } from "express";
import { ownerRouter } from "./modules/owner/owner.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes.js";
import { filesRouter } from "./modules/files/files.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { studentRouter, deptRouter } from "./modules/student/student.routes.js";
import { storeRouter } from "./modules/store/store.routes.js";
import { integrationsRouter } from "./modules/integrations/integrations.routes.js";
import { profileRouter } from "./modules/profile/profile.routes.js";
import { universityRouter } from "./modules/university/university.routes.js";
import { assistantRouter } from "./modules/assistant/assistant.routes.js";
import { meRouter } from "./modules/notifications/notifications.routes.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/owner", ownerRouter);
router.use("/workspaces", workspacesRouter);
router.use("/files", filesRouter);
router.use("/documents", documentsRouter);
router.use("/student", studentRouter);
router.use("/dept", deptRouter);
router.use("/store", storeRouter);
router.use("/integrations", integrationsRouter);
router.use("/profile", profileRouter);
router.use("/university", universityRouter);
router.use("/assistant", assistantRouter);
router.use("/me", meRouter);
