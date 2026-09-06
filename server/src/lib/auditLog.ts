import { prisma } from "./prisma.js";

interface AuditInput {
  userId?: string;
  /**
   * الجامعة التي وقع عليها الحدث — قد تختلف عن مستأجر الفاعل.
   * عمليات المالك تقع على جامعات ليست مستأجره، فبلا هذا الحقل يصير السجل بلا معنى:
   * «غُيّرت لائحة» دون معرفة لائحة مَن.
   */
  tenantId?: string;
  workspaceId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

/** يكتب حدثًا في سجل التدقيق append-only (الحماية من UPDATE/DELETE مفروضة بـ trigger في القاعدة) */
export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before as never,
      after: input.after as never,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  });
}
