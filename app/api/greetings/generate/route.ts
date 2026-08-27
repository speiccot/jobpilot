import OpenAI from "openai";

import {
  db,
} from "../../../../lib/db";

import {
  loadCandidateStore,
} from "../../../../lib/candidateStore";

export const runtime =
  "nodejs";

const client =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

type GreetingJob = {
  id: number;
  company: string;
  contactName: string;
  title: string;
  score: number;
  summary: string;
  topMatches: string[];
  mainGap: string;
};

export async function POST() {
  try {
    // =========================
    // 1. Candidate
    // 这里只拿姓名
    // 不重新传完整 Resume
    // =========================

    const candidateStore =
      await loadCandidateStore();

    if (!candidateStore) {
      return Response.json(
        {
          success: false,
          error:
            "尚未上传简历，请先上传候选人简历。",
        },
        {
          status: 400,
        }
      );
    }

    const candidateName =
      candidateStore
        .candidateProfile
        ?.name ||
      "候选人";

    // =========================
    // 2. 找所有待生成 Greeting
    // =========================

    const rows =
      db.prepare(`
        SELECT
          id,

          company,

          contact_name
            AS contactName,

          title,

          score,

          match_summary
            AS summary,

          top_matches
            AS topMatches,

          main_gap
            AS mainGap

        FROM applications

        WHERE
          status = 'READY_TO_GREET'

          AND (
            greeting_message IS NULL
            OR greeting_message = ''
          )

        ORDER BY
          score DESC
      `).all() as any[];

    if (
      rows.length === 0
    ) {
      return Response.json({
        success: true,
        generated: 0,
        message:
          "当前没有需要生成打招呼内容的职位。",
      });
    }

    const jobs: GreetingJob[] =
      rows.map(
        (row) => ({
          id:
            row.id,

          company:
            row.company || "",

          contactName:
            row.contactName || "",

          title:
            row.title || "",

          score:
            row.score || 0,

          summary:
            row.summary || "",

          topMatches:
            safeParseArray(
              row.topMatches
            ),

          mainGap:
            row.mainGap || "",
        })
      );

    // =========================
    // 3. Greeting Prompt
    // 不重新分析职位
    // 只利用 Fast Match 的结果
    // =========================

    const prompt = `
你是 JobPilot 的招聘平台开场白生成模块。

候选人姓名：

${candidateName}

下面是一组已经通过 Fast Match 的职位。

这些职位已经完成匹配分析。

你不需要重新判断匹配度，
也不需要重新分析职位。

你的唯一任务是：

根据已有匹配证据，
为每个职位生成一条适合 BOSS 直聘首次沟通的中文开场白。

========================
Jobs
========================

${JSON.stringify(
  jobs,
  null,
  2
)}

========================
要求
========================

每个职位独立生成。

必须使用当前职位对应的：

- company
- contactName
- title
- topMatches
- summary

不得混用其他职位的信息。

不得编造候选人不存在的经历。

不要主动强调 mainGap。

开场白要求：

1. 中文
2. 自然
3. 简短
4. 像真人在 BOSS 直聘聊天
5. 不要写成长求职信
6. 推荐约 50-100 个中文字符
7. 最多提 1-2 个最相关经历
8. 表达希望进一步沟通
9. 不要使用夸张表达
10. 不要写“我的匹配度是XX分”

如果 contactName 存在：

自然称呼，例如：

“王女士您好”

如果不存在：

直接使用：

“您好”

========================
输出
========================

只能返回合法 JSON 数组。

输入多少个职位，
必须输出多少条。

格式：

[
  {
    "id": 1,
    "greetingMessage": ""
  }
]

id 必须与输入职位 id 完全一致。

不要输出 Markdown。

不要输出 JSON 以外的任何内容。
`;

    // =========================
    // 4. LLM
    // =========================

    const response =
      await client.responses.create({
        model:
          process.env
            .OPENAI_MODEL ||
          "gpt-5-mini",

        input: prompt,
      });

    const rawOutput =
      response.output_text
        .trim()
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /```$/i,
          ""
        )
        .trim();

    let results: any[];

    try {
      results =
        JSON.parse(
          rawOutput
        );
    } catch {
      console.error(
        "Greeting JSON 解析失败：",
        rawOutput
      );

      return Response.json(
        {
          success: false,
          error:
            "AI 返回的 Greeting 格式不正确",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !Array.isArray(results)
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Greeting 返回结果不是数组",
        },
        {
          status: 500,
        }
      );
    }

    // =========================
    // 5. 验证 ID
    // =========================

    const expectedIds =
      new Set(
        jobs.map(
          (job) =>
            job.id
        )
      );

    const resultMap =
      new Map<
        number,
        string
      >();

    for (
      const item
      of results
    ) {
      const id =
        Number(item.id);

      const greetingMessage =
        typeof item
          .greetingMessage ===
        "string"
          ? item
              .greetingMessage
              .trim()
          : "";

      if (
        expectedIds.has(id) &&
        greetingMessage
      ) {
        resultMap.set(
          id,
          greetingMessage
        );
      }
    }

    if (
      resultMap.size !==
      jobs.length
    ) {
      return Response.json(
        {
          success: false,
          error:
            `Greeting 返回数量不正确：预期 ${jobs.length} 条，实际 ${resultMap.size} 条`,
        },
        {
          status: 500,
        }
      );
    }

    // =========================
    // 6. 保存数据库
    // =========================

    const update =
      db.prepare(`
        UPDATE applications

        SET
          greeting_message =
            @greetingMessage,

          status =
            'GREETING_READY',

          updated_at =
            @updatedAt

        WHERE id =
          @id
      `);

    const save =
      db.transaction(
        () => {
          const now =
            new Date()
              .toISOString();

          for (
            const job
            of jobs
          ) {
            update.run({
              id:
                job.id,

              greetingMessage:
                resultMap.get(
                  job.id
                ),

              updatedAt:
                now,
            });
          }
        }
      );

    save();

    // =========================
    // 7. 返回
    // =========================

    return Response.json({
      success: true,

      generated:
        jobs.length,

      message:
        `已生成 ${jobs.length} 条打招呼内容`,
    });

  } catch (error: any) {
    console.error(
      "Greeting Generator 失败：",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          "生成打招呼内容失败",
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