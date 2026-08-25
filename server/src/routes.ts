import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes.js";
import { filesRouter } from "./modules/files/files.routes.js";
import { billingRouter } from "./modules/billing/billing.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/workspaces", workspacesRouter);
router.use("/files", filesRouter);
router.use("/billing", billingRouter);
router.use("/documents", documentsRouter);
