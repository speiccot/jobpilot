import OpenAI from "openai";
import { z } from "zod";

import {
  loadCandidateStore,
} from "../../../lib/candidateStore";

import {
  db,
} from "../../../lib/db";

const RequestSchema = z.object({
  jobId:
    z.string().min(1),

  title:
    z.string().default(""),

  company:
    z.string().default(""),

  contactName:
    z.string().default(""),

  recruiterTitle:
    z.string().default(""),

  salary:
    z.string().default(""),

  location:
    z.string().default(""),

  address:
    z.string().default(""),

  jd:
    z.string().min(20),

  url:
    z.string().default(""),
});

const client =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

export async function POST(
  req: Request
) {
  try {
    // =====================
    // 1. Job
    // =====================

    const payload =
      RequestSchema.parse(
        await req.json()
      );

    // =====================
    // 2. Candidate
    // =====================

    const candidateStore =
      await loadCandidateStore();

    if (!candidateStore) {
      return Response.json(
        {
          error:
            "尚未上传简历，请先上传候选人简历。",
        },
        {
          status: 400,
        }
      );
    }

    const {
      candidateProfile,
    } = candidateStore;

    // 注意：
    // Fast Match 不再把整份 rawResumeText
    // 每次重复发给模型。
    //
    // 这里只使用 Candidate Profile。

    // =====================
    // 3. Fast Match Prompt
    // =====================

    const prompt = `
你是 JobPilot 的 Fast Match Engine。

JobPilot 是面向任何职业和行业的通用求职产品。

你的任务是：

根据 Candidate Profile 与当前 Job，
快速、独立地判断候选人与岗位的匹配程度。

不要生成求职信。
不要生成打招呼内容。
不要生成长篇分析。

========================
Candidate Profile
========================

${JSON.stringify(
  candidateProfile,
  null,
  2
)}

========================
Job
========================

${JSON.stringify(
  {
    jobId:
      payload.jobId,

    company:
      payload.company,

    title:
      payload.title,

    salary:
      payload.salary,

    location:
      payload.location,

    jd:
      payload.jd,
  },
  null,
  2
)}

========================
评分原则
========================

score 必须为 0-100 整数。

评分必须基于：

1. 工作经历匹配程度
2. 核心职责匹配程度
3. 技能与工具匹配程度
4. 工作年限与 seniority
5. 行业或业务场景经验
6. 教育或资质要求
7. 可迁移能力

不要因为关键词相同就直接认为匹配。

不得编造 Candidate Profile 中不存在的经历。

如果岗位核心要求明显缺失，
必须降低评分。

========================
用户解释
========================

summary：

用 2-3 句中文告诉用户：

- 为什么这个岗位适合或不适合候选人
- 重点考虑经验、要求、岗位类型、seniority 等
- 不要写成长篇报告

topMatches：

最多 3 条最重要的匹配点。

mainGap：

最多写 1 个最重要的缺口。

如果没有明显缺口，
返回空字符串。

========================
职位结构化信息
========================

同时判断：

jobFamily
roleType
seniority
industry

roleType 描述职位本身，
不能根据 Candidate 的背景改变。

========================
输出
========================

只能返回合法 JSON：

{
  "jobFamily": "",
  "roleType": "",
  "seniority": "",
  "industry": "",

  "score": 0,

  "summary": "",

  "topMatches": [
    "",
    "",
    ""
  ],

  "mainGap": ""
}

不要输出 Markdown。

不要输出 JSON 以外的内容。
`;

    // =====================
    // 4. LLM
    // =====================

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

    let result;

    try {
      result =
        JSON.parse(
          rawOutput
        );

    } catch {
      console.error(
        "Fast Match JSON 解析失败：",
        rawOutput
      );

      return Response.json(
        {
          error:
            "AI 返回的匹配结果格式不正确",
        },
        {
          status: 500,
        }
      );
    }

    // =====================
    // 5. Validate
    // =====================

    if (
      typeof result.score !==
      "number"
    ) {
      result.score = 0;
    }

    result.score =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            result.score
          )
        )
      );

    if (
      !Array.isArray(
        result.topMatches
      )
    ) {
      result.topMatches =
        [];
    }

    result.topMatches =
      result.topMatches
        .slice(0, 3)
        .filter(Boolean);

    result.summary =
      typeof result.summary ===
      "string"
        ? result.summary
        : "";

    result.mainGap =
      typeof result.mainGap ===
      "string"
        ? result.mainGap
        : "";

    // =====================
    // 6. User Settings
    // =====================

    const settings =
      db.prepare(`
        SELECT
          skip_threshold
            AS skipThreshold,

          greet_threshold
            AS greetThreshold

        FROM settings

        WHERE id = 1
      `).get() as any;

    // =====================
    // 7. Deterministic
    // Decision Engine
    // =====================

    let status =
      "JOB_POOL";

    if (
      result.score <
      settings.skipThreshold
    ) {
      status =
        "SKIPPED";

    } else if (
      result.score >=
      settings.greetThreshold
    ) {
      status =
        "READY_TO_GREET";
    }

    let recommendation =
      "review";

    if (
      status ===
      "READY_TO_GREET"
    ) {
      recommendation =
        "apply";
    }

    if (
      status ===
      "SKIPPED"
    ) {
      recommendation =
        "skip";
    }

    // =====================
    // 8. Save
    // =====================

    const now =
      new Date()
        .toISOString();

    const statement =
      db.prepare(`
        INSERT INTO applications (
          job_id,

          company,
          contact_name,
          recruiter_title,

          title,
          salary,
          location,
          address,
          url,
          jd,

          job_family,
          role_type,
          seniority,
          industry,

          score,
          recommendation,

          match_summary,
          top_matches,
          main_gap,

          greeting_message,

          status,

          created_at,
          updated_at
        )

        VALUES (
          @jobId,

          @company,
          @contactName,
          @recruiterTitle,

          @title,
          @salary,
          @location,
          @address,
          @url,
          @jd,

          @jobFamily,
          @roleType,
          @seniority,
          @industry,

          @score,
          @recommendation,

          @matchSummary,
          @topMatches,
          @mainGap,

          '',

          @status,

          @createdAt,
          @updatedAt
        )

        ON CONFLICT(job_id)

        DO UPDATE SET

          company =
            excluded.company,

          contact_name =
            excluded.contact_name,

          recruiter_title =
            excluded.recruiter_title,

          title =
            excluded.title,

          salary =
            excluded.salary,

          location =
            excluded.location,

          address =
            excluded.address,

          url =
            excluded.url,

          jd =
            excluded.jd,

          job_family =
            excluded.job_family,

          role_type =
            excluded.role_type,

          seniority =
            excluded.seniority,

          industry =
            excluded.industry,

          score =
            excluded.score,

          recommendation =
            excluded.recommendation,

          match_summary =
            excluded.match_summary,

          top_matches =
            excluded.top_matches,

          main_gap =
            excluded.main_gap,

          status =
            excluded.status,

          updated_at =
            excluded.updated_at
      `);

    statement.run({
      jobId:
        payload.jobId,

      company:
        payload.company || "",

      contactName:
        payload.contactName || "",

      recruiterTitle:
        payload.recruiterTitle || "",

      title:
        payload.title || "",

      salary:
        payload.salary || "",

      location:
        payload.location || "",

      address:
        payload.address || "",

      url:
        payload.url || "",

      jd:
        payload.jd,

      jobFamily:
        result.jobFamily ||
        "Other",

      roleType:
        result.roleType ||
        payload.title,

      seniority:
        result.seniority ||
        "Unknown",

      industry:
        result.industry ||
        "Unknown",

      score:
        result.score,

      recommendation,

      matchSummary:
        result.summary,

      topMatches:
        JSON.stringify(
          result.topMatches
        ),

      mainGap:
        result.mainGap,

      status,

      createdAt:
        now,

      updatedAt:
        now,
    });

    // =====================
    // 9. Response
    // =====================

    return Response.json({
      jobId:
        payload.jobId,

      score:
        result.score,

      summary:
        result.summary,

      topMatches:
        result.topMatches,

      mainGap:
        result.mainGap,

      jobFamily:
        result.jobFamily,

      roleType:
        result.roleType,

      seniority:
        result.seniority,

      industry:
        result.industry,

      recommendation,

      status,
    });

  } catch (error: any) {
    console.error(
      "Fast Match 失败：",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "职位匹配失败",
      },
      {
        status: 400,
      }
    );
  }
}