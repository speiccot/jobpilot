import OpenAI from "openai";
import { z } from "zod";

import {
  loadCandidateStore,
} from "../../../lib/candidateStore";

import {
  db,
} from "../../../lib/db";

const RequestSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  salary: z.string().default(""),
  location: z.string().default(""),
  jd: z.string().min(20),
  url: z.string().optional(),
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // 1. 读取当前职位
    const payload = RequestSchema.parse(
      await req.json()
    );

    // 2. 读取候选人的 Master Resume
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

    // 3. 通用职位理解 + 通用匹配 Prompt
    const prompt = `
你是 JobPilot 的 Job Intelligence 与 Candidate Matching 模块。

JobPilot 是一个通用求职产品。

它必须能够处理任何职业和行业的职位，
包括但不限于：

产品
工程
软件开发
数据
算法
人工智能
财务
会计
金融
咨询
销售
商务拓展
市场营销
运营
供应链
物流
人力资源
行政
设计
建筑
制造
机械
电子
教育
医疗
医药
零售
餐饮
以及其他任何职业。

不要假设候选人一定从事互联网、AI、产品或数据相关工作。

你的任务分为两个阶段。

================================
第一阶段：理解职位
================================

根据职位标题和 JD，识别：

1. jobFamily
   职位所属的大类。

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
   Other

   可以根据实际职位生成合理的大类，
   不需要强行限制在上述示例中。

2. roleType

   标准化、具体的职位名称。

   例如：
   Frontend Engineer
   AI Product Manager
   Financial Analyst
   Accountant
   Medical Sales Representative
   Operations Manager
   Mechanical Engineer

   roleType 不允许根据候选人的背景决定。

   它描述的是：
   “这个职位本身是什么”。

3. seniority

   根据职位要求判断：

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

   判断职位对应的主要行业。

   如果 JD 无法明确判断，
   返回 "Unknown"。

5. requiredSkills

   提取完成这份工作的主要技能、知识、工具、
   资质或能力要求。

   不要只提取技术技能。

   例如销售岗位可能包括：
   客户开发
   商务谈判
   客户关系管理

   会计岗位可能包括：
   Financial Reporting
   GAAP
   Excel
   Reconciliation

================================
第二阶段：Candidate Match
================================

候选人结构化画像：

${JSON.stringify(candidateProfile, null, 2)}

候选人原始 Resume：

${rawResumeText}

当前职位：

${JSON.stringify(payload, null, 2)}

判断 Candidate 与 Job 的匹配度。

核心规则：

1. 必须基于真实 Resume。

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

3. 不要因为候选人与 JD 出现相似关键词，
   就认为候选人具备该能力。

必须能够从 Resume 中找到合理证据。

4. 如果岗位要求某项重要能力，
   但 Resume 中没有证据，
   必须放进 risks。

5. 匹配判断必须适用于任何职业。

不要使用固定的：

AI能力
产品能力
数据能力
工程能力

作为所有职位的统一评价框架。

而是根据当前职位本身的要求，
动态判断 Candidate 是否满足。

重点考虑：

- 核心工作职责
- Required Skills
- Preferred Skills
- 工作经验
- Seniority
- Industry Experience
- Education
- Certifications
- Transferable Skills
- Candidate 成果与岗位要求之间的证据关系

6. score：

0-100。

高分意味着：

候选人的真实经历能够较直接地支持
完成这个岗位最重要的职责。

7. recommendation：

apply：
整体匹配度高，值得申请。

maybe：
存在一定匹配，但有明显 gap。

skip：
核心职责或关键要求明显不匹配。

8. greetingMessage：

用于招聘平台首次打招呼。

要求：

- 中文
- 自然
- 简短
- 针对当前职位
- 使用 Resume 中最相关的真实经历
- 不得编造经历
- 不要写得像求职信
- 尽量控制在 100 个中文字符左右

================================
输出
================================

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

reasons：
正好 3 条。

risks：
0-3 条。

不要输出 Markdown。

不要输出 JSON 以外的内容。
`;

    // 4. 调用 OpenAI
    const response =
      await client.responses.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5-mini",
        input: prompt,
      });

    // 5. 清理模型输出
    const rawOutput =
      response.output_text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    // 6. JSON Parse
    let result;

    try {
      result = JSON.parse(rawOutput);
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
      typeof result.score !== "number"
    ) {
      result.score = 0;
    }

    result.score = Math.max(
      0,
      Math.min(
        100,
        Math.round(result.score)
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
      result.recommendation = "maybe";
    }

    if (
      !Array.isArray(
        result.requiredSkills
      )
    ) {
      result.requiredSkills = [];
    }

    if (!Array.isArray(result.reasons)) {
      result.reasons = [];
    }

    if (!Array.isArray(result.risks)) {
      result.risks = [];
    }

    // 8. 保存数据库
    const now =
      new Date().toISOString();

    const statement = db.prepare(`
      INSERT INTO applications (
        company,
        title,
        salary,
        location,
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
        @company,
        @title,
        @salary,
        @location,
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

      ON CONFLICT(url)

      DO UPDATE SET
        company = excluded.company,
        title = excluded.title,
        salary = excluded.salary,
        location = excluded.location,
        jd = excluded.jd,

        job_family = excluded.job_family,
        role_type = excluded.role_type,
        seniority = excluded.seniority,
        industry = excluded.industry,
        skills = excluded.skills,

        score = excluded.score,
        recommendation = excluded.recommendation,

        match_reasons = excluded.match_reasons,
        risks = excluded.risks,

        greeting_message = excluded.greeting_message,
        updated_at = excluded.updated_at
    `);

    statement.run({
      company:
        payload.company || "",

      title:
        payload.title || "",

      salary:
        payload.salary || "",

      location:
        payload.location || "",

      url:
        payload.url || null,

      jd:
        payload.jd,

      jobFamily:
        result.jobFamily || "Other",

      roleType:
        result.roleType || payload.title,

      seniority:
        result.seniority || "Unknown",

      industry:
        result.industry || "Unknown",

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
        result.openingMessage || "",

      createdAt:
        now,

      updatedAt:
        now,
    });

    // 9. 返回给 Chrome Extension
    return Response.json(result);

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