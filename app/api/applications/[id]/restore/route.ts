import {
  db,
} from "../../../../../lib/db";

export const runtime =
  "nodejs";

export async function POST(
  _req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const {
      id,
    } =
      await context.params;

    const applicationId =
      Number(id);

    if (
      !Number.isInteger(
        applicationId
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "无效的职位 ID",
        },
        {
          status: 400,
        }
      );
    }

    const application =
      db.prepare(`
        SELECT
          id,
          status

        FROM applications

        WHERE id = ?
      `).get(
        applicationId
      ) as any;

    if (!application) {
      return Response.json(
        {
          success: false,
          error:
            "职位不存在",
        },
        {
          status: 404,
        }
      );
    }

    const now =
      new Date()
        .toISOString();

    db.prepare(`
      UPDATE applications

      SET
        status =
          'JOB_POOL',

        updated_at =
          ?

      WHERE id = ?
    `).run(
      now,
      applicationId
    );

    return Response.json({
      success: true,
      status:
        "JOB_POOL",
    });

  } catch (error: any) {
    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          "恢复职位失败",
      },
      {
        status: 500,
      }
    );
  }
}