import OpenAI from "openai";
import { z } from "zod";

import {
  loadCandidateStore,
} from "../../../lib/candidateStore";

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

    // 2. 读取用户已经上传并解析好的 Resume
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

    // 3. 构造职位匹配 Prompt
    const prompt = `
你是 JobPilot 的职位匹配模块。

你的任务是根据候选人的真实简历和当前职位 JD，
判断这个职位与候选人的匹配程度。

候选人结构化画像：

${JSON.stringify(candidateProfile, null, 2)}

候选人原始 Resume：

${rawResumeText}

当前职位：

${JSON.stringify(payload, null, 2)}

重要规则：

1. 所有判断必须基于候选人的真实 Resume。
2. 严禁编造候选人没有做过的工作经历、技能、工具、项目、行业经验或业务经验。
3. 如果 JD 要求某项能力，但 Resume 中没有明确证据，必须列入 risks，而不能假设候选人具备。
4. 重点判断：
   - 核心职责匹配度
   - 技能匹配度
   - 行业/业务场景匹配度
   - 工作经验与 seniority 匹配度
   - AI / 数据 / 产品能力匹配度
5. 匹配度不是关键词数量，而是候选人的实际经历能否完成该岗位核心工作。
6. openingMessage 必须基于候选人的真实经历。
7. openingMessage 不得声称候选人拥有 Resume 中不存在的经验。
8. 输出全部使用中文。
9. 最终只返回合法 JSON，不要输出 Markdown 或其他解释。

请严格返回：

{
  "score": 0,
  "recommendation": "apply",
  "roleType": "AI Product Manager",
  "reasons": [
    "",
    "",
    ""
  ],
  "risks": [],
  "openingMessage": ""
}

字段要求：

- score：0 到 100 的整数
- recommendation：
  - apply
  - maybe
  - skip
- roleType：
  - AI Product Manager
  - Data Scientist
  - AI Engineer
  - Other
- reasons：必须正好 3 条
- risks：0 到 3 条
- openingMessage：
  - 中文
  - 自然
  - 针对当前 JD
  - 尽量控制在 120 个中文字符以内
`;

    // 4. 调用 OpenAI
    const response =
      await client.responses.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5-mini",
        input: prompt,
      });

    // 5. 清洗模型输出
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
        "职位匹配 JSON 解析失败：",
        rawOutput
      );

      return Response.json(
        {
          error:
            "AI 返回的职位匹配结果格式不正确",
        },
        {
          status: 500,
        }
      );
    }

    // 7. 返回给 Chrome Extension
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