import type { UserRole } from "@mihwar/shared";

export interface AuthContext {
  userId: string;
  /** حدّ العزل، من التوكن الموقّع وحده. */
  tenantId: string;
  role: UserRole;
  tokenVersion: number;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
      /** مساحة العمل المحسومة من عضوية المستخدم + معامل المسار — لا تُقبل من body/query أبدًا */
      workspaceId?: string;
    }
  }
}

export {};
