import OpenAI from "openai";
import { z } from "zod";
import { getEncoding } from "js-tiktoken";

import {
  loadCandidateStore,
} from "../../../../lib/candidateStore";

import {
  db,
} from "../../../../lib/db";

export const runtime = "nodejs";

// =========================
// Config
// =========================

// 一个 LLM Batch 最多大约使用多少输入 token
const MAX_BATCH_INPUT_TOKENS = 24000;

// 即使 JD 很短，一个 Batch 也最多放这么多职位
const MAX_JOBS_PER_BATCH = 20;

// 最多同时跑多少个 LLM Batch
const MAX_CONCURRENCY = 3;

// GPT-5 系列使用的通用 tokenizer
const encoding =
  getEncoding("o200k_base");

// =========================
// Request Schema
// =========================

const JobSchema = z.object({
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

const RequestSchema = z.object({
  jobs:
    z.array(JobSchema)
      .min(1)
      .max(500),
});

type Job =
  z.infer<typeof JobSchema>;

type MatchResult = {
  jobId: string;

  jobFamily: string;
  roleType: string;
  seniority: string;
  industry: string;

  score: number;

  summary: string;

  topMatches: string[];

  mainGap: string;
};

const client =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

// =========================
// Token Count
// =========================

function countTokens(
  value: unknown
) {
  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(value);

  return encoding.encode(
    text
  ).length;
}

// =========================
// Build Token-aware Batches
// =========================

function buildBatches(
  jobs: Job[],
  candidateProfile: unknown
) {
  const batches: Job[][] = [];

  // Candidate Profile 在每一个 Batch
  // 中只出现一次
  const baseTokens =
    countTokens(
      candidateProfile
    ) + 1500;

  let currentBatch: Job[] =
    [];

  let currentTokens =
    baseTokens;

  for (const job of jobs) {
    const jobTokens =
      countTokens(job) + 150;

    const exceedsTokenLimit =
      currentTokens +
        jobTokens >
      MAX_BATCH_INPUT_TOKENS;

    const exceedsJobLimit =
      currentBatch.length >=
      MAX_JOBS_PER_BATCH;

    if (
      currentBatch.length > 0 &&
      (
        exceedsTokenLimit ||
        exceedsJobLimit
      )
    ) {
      batches.push(
        currentBatch
      );

      currentBatch = [];
      currentTokens =
        baseTokens;
    }

    currentBatch.push(job);

    currentTokens +=
      jobTokens;
  }

  if (
    currentBatch.length > 0
  ) {
    batches.push(
      currentBatch
    );
  }

  return batches;
}

// =========================
// One LLM Batch
// =========================

async function analyzeBatch(
  jobs: Job[],
  candidateProfile: unknown
): Promise<MatchResult[]> {
  const prompt = `
你是 JobPilot 的 Fast Match Engine。

你会收到：

1. 一个 Candidate Profile
2. 一组彼此独立的 Job

你的任务是对每个 Job 独立进行 Candidate Match。

========================
最重要的独立性规则
========================

每一个 Job 必须完全独立评分。

严禁：

- 比较不同 Job 的优劣
- 根据同一个 Batch 中其他 Job 调整评分
- 使用 Job A 的要求评估 Job B
- 因为 Batch 中存在更好的岗位而降低另一个岗位的分数
- 对整个 Batch 做排名
- 对 score 做相对归一化

对于每一个 Job：

只能使用：

Candidate Profile
+
当前这个 Job

进行判断。

例如：

Job A 的 85 分意味着：
Candidate 与 Job A 本身匹配度为 85。

与 Job B、Job C 得多少分完全无关。

========================
Candidate Profile
========================

${JSON.stringify(
  candidateProfile,
  null,
  2
)}

========================
Jobs
========================

${JSON.stringify(
  jobs,
  null,
  2
)}

========================
评分规则
========================

每个 Job 的 score：

0-100 整数。

需要综合考虑：

- 工作经历
- 核心职责
- Required Skills
- 工作年限
- Seniority
- 行业/业务场景
- Education
- Certifications
- Transferable Skills

不得编造 Candidate Profile 中不存在的信息。

不要因为关键词相同就直接判定匹配。

========================
用户解释
========================

每个职位还需要：

summary

用 2-3 句简短中文解释：

为什么这个职位适合或不适合候选人。

重点可以包括：

经验
岗位要求
工作类型
seniority
行业背景

不要写成长篇分析。

topMatches

最多 3 条最重要的匹配点。

mainGap

最多 1 个最重要的缺口。

没有明显缺口时返回空字符串。

========================
职位信息
========================

同时判断：

jobFamily
roleType
seniority
industry

roleType 描述的是职位本身，
不能根据 Candidate 的背景改变。

========================
输出要求
========================

必须返回 JSON 数组。

数组中的每一项必须对应输入中的一个 jobId。

输入多少个 Job，
必须输出多少个结果。

不能：

- 漏掉 jobId
- 增加不存在的 jobId
- 重复 jobId

严格格式：

[
  {
    "jobId": "",

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
]

不要输出 Markdown。

不要输出 JSON 之外的内容。
`;

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

  let results;

  try {
    results =
      JSON.parse(rawOutput);

  } catch {
    console.error(
      "Batch Fast Match JSON 解析失败：",
      rawOutput
    );

    throw new Error(
      "AI 返回的批量匹配结果格式不正确"
    );
  }

  if (
    !Array.isArray(results)
  ) {
    throw new Error(
      "批量匹配结果不是数组"
    );
  }

  // =====================
  // Validate Job IDs
  // =====================

  const expectedIds =
    new Set(
      jobs.map(
        (job) =>
          job.jobId
      )
    );

  const returnedIds =
    new Set(
      results.map(
        (item: any) =>
          item.jobId
      )
    );

  if (
    expectedIds.size !==
    returnedIds.size
  ) {
    throw new Error(
      "Batch 返回的职位数量不正确"
    );
  }

  for (
    const jobId
    of expectedIds
  ) {
    if (
      !returnedIds.has(
        jobId
      )
    ) {
      throw new Error(
        `Batch 缺少职位：${jobId}`
      );
    }
  }

  // =====================
  // Normalize
  // =====================

  return results.map(
    (item: any) => {
      let score =
        Number(
          item.score
        );

      if (
        !Number.isFinite(
          score
        )
      ) {
        score = 0;
      }

      score =
        Math.max(
          0,
          Math.min(
            100,
            Math.round(score)
          )
        );

      const topMatches =
        Array.isArray(
          item.topMatches
        )
          ? item.topMatches
              .filter(Boolean)
              .slice(0, 3)

          : [];

      return {
        jobId:
          item.jobId,

        jobFamily:
          item.jobFamily ||
          "Other",

        roleType:
          item.roleType ||
          "",

        seniority:
          item.seniority ||
          "Unknown",

        industry:
          item.industry ||
          "Unknown",

        score,

        summary:
          typeof item.summary ===
          "string"
            ? item.summary
            : "",

        topMatches,

        mainGap:
          typeof item.mainGap ===
          "string"
            ? item.mainGap
            : "",
      };
    }
  );
}

// =========================
// Concurrency Pool
// =========================

async function runWithConcurrency<
  T,
  R
>(
  items: T[],
  concurrency: number,
  worker:
    (
      item: T,
      index: number
    ) => Promise<R>
) {
  const results:
    (
      | R
      | undefined
    )[] =
    new Array(
      items.length
    );

  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index =
        nextIndex++;

      if (
        index >=
        items.length
      ) {
        return;
      }

      results[index] =
        await worker(
          items[index],
          index
        );
    }
  }

  const workers =
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            items.length
          ),
      },

      () =>
        runWorker()
    );

  await Promise.all(
    workers
  );

  return results as R[];
}

// =========================
// POST
// =========================

export async function POST(
  req: Request
) {
  try {
    // =====================
    // 1. Input
    // =====================

    const {
      jobs,
    } =
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
          success: false,

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

    // =====================
    // 3. Deduplicate request
    // =====================

    const uniqueJobs =
      Array.from(
        new Map(
          jobs.map(
            (job) => [
              job.jobId,
              job,
            ]
          )
        ).values()
      );

    // =====================
    // 4. Skip jobs already
    // analyzed
    // =====================

    const newJobs: Job[] =
      [];

    const existingJobIds:
      string[] =
      [];

    const findExisting =
      db.prepare(`
        SELECT
          job_id AS jobId

        FROM applications

        WHERE job_id = ?
      `);

    for (
      const job
      of uniqueJobs
    ) {
      const existing =
        findExisting.get(
          job.jobId
        ) as any;

      if (existing) {
        existingJobIds.push(
          job.jobId
        );
      } else {
        newJobs.push(job);
      }
    }

    // 如果全都扫描过了
    if (
      newJobs.length === 0
    ) {
      return Response.json({
        success: true,

        requested:
          uniqueJobs.length,

        analyzed: 0,

        skippedExisting:
          existingJobIds.length,

        batchCount: 0,

        results: [],
      });
    }

    // =====================
    // 5. Build batches
    // =====================

    const batches =
      buildBatches(
        newJobs,
        candidateProfile
      );

    console.log(
      `JobPilot Batch Match: ${newJobs.length} jobs → ${batches.length} batches`
    );

    // =====================
    // 6. LLM concurrently
    // =====================

    const batchResults =
      await runWithConcurrency(
        batches,

        MAX_CONCURRENCY,

        async (
          batch,
          index
        ) => {
          console.log(
            `Running Fast Match batch ${
              index + 1
            } / ${
              batches.length
            }, jobs=${
              batch.length
            }`
          );

          return analyzeBatch(
            batch,
            candidateProfile
          );
        }
      );

    const results =
      batchResults.flat();

    // =====================
    // 7. Settings
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
    // 8. Job Lookup
    // =====================

    const jobMap =
      new Map(
        newJobs.map(
          (job) => [
            job.jobId,
            job,
          ]
        )
      );

    // =====================
    // 9. DB Statement
    // =====================

    const insertStatement =
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

    // =====================
    // 10. Transaction
    // =====================

    const saveResults =
      db.transaction(
        () => {
          const now =
            new Date()
              .toISOString();

          for (
            const result
            of results
          ) {
            const job =
              jobMap.get(
                result.jobId
              );

            if (!job) {
              continue;
            }

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

            insertStatement.run({
              jobId:
                job.jobId,

              company:
                job.company ||
                "",

              contactName:
                job.contactName ||
                "",

              recruiterTitle:
                job.recruiterTitle ||
                "",

              title:
                job.title ||
                "",

              salary:
                job.salary ||
                "",

              location:
                job.location ||
                "",

              address:
                job.address ||
                "",

              url:
                job.url ||
                "",

              jd:
                job.jd,

              jobFamily:
                result.jobFamily,

              roleType:
                result.roleType ||
                job.title,

              seniority:
                result.seniority,

              industry:
                result.industry,

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
          }
        }
      );

    saveResults();

    // =====================
    // 11. Response
    // =====================

    return Response.json({
      success: true,

      requested:
        uniqueJobs.length,

      analyzed:
        results.length,

      skippedExisting:
        existingJobIds.length,

      batchCount:
        batches.length,

      results,
    });

  } catch (error: any) {
    console.error(
      "Batch Fast Match failed:",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          "批量职位匹配失败",
      },
      {
        status: 400,
      }
    );
  }
}