import {
  db,
} from "../../../lib/db";

export const runtime =
  "nodejs";

export async function GET() {
  try {
    const rows =
      db.prepare(`
        SELECT
          id,

          job_id
            AS jobId,

          company,

          contact_name
            AS contactName,

          recruiter_title
            AS recruiterTitle,

          title,
          salary,
          location,
          address,
          url,

          job_family
            AS jobFamily,

          role_type
            AS roleType,

          seniority,
          industry,

          score,
          recommendation,

          match_summary
            AS summary,

          top_matches
            AS topMatches,

          main_gap
            AS mainGap,

          greeting_message
            AS greetingMessage,

          status,

          created_at
            AS createdAt,

          updated_at
            AS updatedAt

        FROM applications

        ORDER BY
          score DESC,
          created_at DESC
      `).all() as any[];

    const applications =
      rows.map(
        (row) => ({
          ...row,

          topMatches:
            safeParseArray(
              row.topMatches
            ),
        })
      );

    return Response.json({
      success: true,

      count:
        applications.length,

      applications,
    });

  } catch (error: any) {
    console.error(
      "读取职位记录失败：",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          "读取职位记录失败",
      },
      {
        status: 500,
      }
    );
  }
}

function safeParseArray(
  value: string | null
) {
  if (!value) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];

  } catch {
    return [];
  }
}