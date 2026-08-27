import OpenAI from "openai";
import { z } from "zod";

import {
  loadCandidateStore,
} from "../../../lib/candidateStore";

import {
  db,
} from "../../../lib/db";

const RequestSchema = z.object({
  jobId: z.string().min(1),

  title: z.string().default(""),
  company: z.string().default(""),
  contactName: z.string().default(""),
  recruiterTitle: z.string().default(""),

  salary: z.string().default(""),
  location: z.string().default(""),
  address: z.string().default(""),

  jd: z.string().min(20),

  url: z.string().default(""),
});

const client = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY,
});

export async function POST(
  req: Request
) {
  try {
    // 1. 当前职位
    const payload =
      RequestSchema.parse(
        await req.json()
      );

    // 2. Candidate Resume
    const candidateStore =
      await loadCandidateStore();

    if (!candidateStore) {
      return Response.json(
        {
          error:
            "尚未上传简历，请先上传并分析候选人简历。",
        },
        {
          status: 400,
        }
      );
    }

    const {
      rawResumeText,
      candidateProfile,
    } = candidateStore;

    // 3. 通用 Job Intelligence + Matching
    const prompt = `
你是 JobPilot 的 Job Intelligence 与 Candidate Matching 模块。

JobPilot 是一个面向任何职业和行业的通用求职产品。

不要假设候选人一定属于互联网、AI、数据或产品行业。

========================
职位信息
========================

${JSON.stringify(
  payload,
  null,
  2
)}

========================
候选人结构化画像
========================

${JSON.stringify(
  candidateProfile,
  null,
  2
)}

========================
候选人原始 Resume
========================

${rawResumeText}

========================
第一阶段：理解职位
========================

判断：

1. jobFamily

职位所属的大类。

根据真实职位生成合理分类。

例如：

Engineering
Product
Data
Finance
Accounting
Sales
Marketing
Operations
Strategy
Consulting
Human Resources
Design
Supply Chain
Legal
Healthcare
Education
Manufacturing
Administration
Customer Service

但不要被示例限制。

2. roleType

标准化、具体的职位名称。

roleType 描述职位本身，
不能根据候选人的背景改变。

3. seniority

可使用：

Intern
Entry-level
Junior
Mid-level
Senior
Lead
Manager
Director
Executive
Unknown

4. industry

判断主要行业。

无法判断时返回：

Unknown

5. requiredSkills

提取完成岗位核心工作的主要：

技能
知识
工具
资质
能力

不能只关注技术技能。

========================
第二阶段：Candidate Match
========================

规则：

1. 所有判断必须基于候选人的真实 Resume。

2. 严禁编造候选人不存在的：

工作经历
技能
项目
工具
行业经验
证书
学历
职责
成果

3. 必须从 Resume 中找到合理证据支持匹配。

4. 如果岗位的重要要求在 Resume 中没有证据，
必须放进 risks。

5. 根据当前岗位动态判断。

重点考虑：

核心职责
Required Skills
Preferred Skills
工作经验
Seniority
Industry Experience
Education
Certifications
Transferable Skills
候选人成果

6. score 为 0-100。

高分代表候选人的真实经历能够直接支持完成该岗位最重要职责。

7. recommendation：

apply
整体匹配度高，值得申请。

maybe
存在一定匹配，但有明显 gap。

skip
核心职责或关键要求明显不匹配。

8. openingMessage

用于招聘平台首次打招呼。

要求：

中文
自然
简短
针对当前岗位
引用最相关的真实经历
不得编造经历
不要写成长求职信
尽量控制在约100个中文字符

招聘联系人：

${payload.contactName || "未知"}

如果联系人姓名存在，可以自然称呼。
如果为空，直接使用“您好”。

========================
输出
========================

只返回合法 JSON：

{
  "jobFamily": "",
  "roleType": "",
  "seniority": "",
  "industry": "",
  "requiredSkills": [],

  "score": 0,
  "recommendation": "apply",

  "reasons": [
    "",
    "",
    ""
  ],

  "risks": [],

  "openingMessage": ""
}

要求：

reasons 正好3条。

risks 0-3条。

不要输出 Markdown。

不要输出 JSON 以外的内容。
`;

    // 4. OpenAI
    const response =
      await client.responses.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5-mini",

        input: prompt,
      });

    // 5. 清洗输出
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

    // 6. JSON Parse
    let result;

    try {
      result =
        JSON.parse(rawOutput);
    } catch {
      console.error(
        "职位分析 JSON 解析失败：",
        rawOutput
      );

      return Response.json(
        {
          error:
            "AI 返回的职位分析结果格式不正确",
        },
        {
          status: 500,
        }
      );
    }

    // 7. 基础校验
    if (
      typeof result.score !==
      "number"
    ) {
      result.score = 0;
    }

    result.score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          result.score
        )
      )
    );

    const validRecommendations = [
      "apply",
      "maybe",
      "skip",
    ];

    if (
      !validRecommendations.includes(
        result.recommendation
      )
    ) {
      result.recommendation =
        "maybe";
    }

    if (
      !Array.isArray(
        result.requiredSkills
      )
    ) {
      result.requiredSkills =
        [];
    }

    if (
      !Array.isArray(
        result.reasons
      )
    ) {
      result.reasons = [];
    }

    if (
      !Array.isArray(
        result.risks
      )
    ) {
      result.risks = [];
    }

    // 8. 保存数据库
    const now =
      new Date().toISOString();

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
          skills,

          score,
          recommendation,

          match_reasons,
          risks,

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
          @skills,

          @score,
          @recommendation,

          @matchReasons,
          @risks,

          @openingMessage,
          'ANALYZED',

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

          skills =
            excluded.skills,

          score =
            excluded.score,

          recommendation =
            excluded.recommendation,

          match_reasons =
            excluded.match_reasons,

          risks =
            excluded.risks,

          greeting_message =
            excluded.greeting_message,

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

      skills:
        JSON.stringify(
          result.requiredSkills
        ),

      score:
        result.score,

      recommendation:
        result.recommendation,

      matchReasons:
        JSON.stringify(
          result.reasons
        ),

      risks:
        JSON.stringify(
          result.risks
        ),

      openingMessage:
        result.openingMessage ||
        "",

      createdAt:
        now,

      updatedAt:
        now,
    });

    // 9. 返回 Extension
    return Response.json(
      result
    );

  } catch (error: any) {
    console.error(
      "职位分析失败：",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "职位分析失败",
      },
      {
        status: 400,
      }
    );
  }
}