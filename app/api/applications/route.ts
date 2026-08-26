import {
  db,
} from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const statement = db.prepare(`
      SELECT
        id,
        company,
        title,
        salary,
        location,
        url,
        score,
        recommendation,
        role_type AS roleType,
        greeting_message AS greetingMessage,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM applications
      ORDER BY created_at DESC
    `);

    const applications = statement.all();

    return Response.json({
      success: true,
      count: applications.length,
      applications,
    });

  } catch (error: any) {
    console.error(
      "读取投递记录失败：",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          "读取投递记录失败",
      },
      {
        status: 500,
      }
    );
  }
}