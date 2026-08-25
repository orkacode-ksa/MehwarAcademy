import { prisma } from "../../lib/prisma.js";

export async function listMyWorkspaces(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          planCode: true,
          subscription: { select: { status: true, trialEndsAt: true } },
        },
      },
    },
  });
}

/** ملخص لوحة الأستاذ: عدد المقررات وحلقة التقدّم لكل مقرر */
export async function getWorkspaceDashboard(workspaceId: string) {
  const courses = await prisma.course.findMany({
    where: { workspaceId, deletedAt: null },
    select: {
      id: true,
      code: true,
      nameAr: true,
      _count: { select: { topics: true, sections: true } },
      qualityItems: { select: { completed: true } },
      topics: {
        where: { deletedAt: null },
        select: { lectures: { where: { status: "PUBLISHED" }, select: { id: true }, take: 1 } },
      },
    },
    take: 50,
  });

  return courses.map((course) => {
    const totalQualityItems = 11;
    const completedQualityItems = course.qualityItems.filter((i) => i.completed).length;
    const publishedTopics = course.topics.filter((t) => t.lectures.length > 0).length;
    return {
      id: course.id,
      code: course.code,
      nameAr: course.nameAr,
      topicsCount: course._count.topics,
      sectionsCount: course._count.sections,
      curriculumProgress: course._count.topics > 0 ? Math.round((publishedTopics / course._count.topics) * 100) : 0,
      qualityCompletion: { completed: completedQualityItems, total: totalQualityItems },
    };
  });
}
