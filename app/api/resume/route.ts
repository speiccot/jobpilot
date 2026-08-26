import OpenAI from "openai";
import mammoth from "mammoth";
import {
  extractText,
  getDocumentProxy,
} from "unpdf";

import {
  saveCandidateStore,
} from "../../../lib/candidateStore";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractResumeText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileName = file.name.toLowerCase();

  // PDF
  if (
    file.type === "application/pdf" ||
    fileName.endsWith(".pdf")
  ) {
    const pdf = await getDocumentProxy(
      new Uint8Array(buffer)
    );

    const result = await extractText(pdf, {
      mergePages: true,
    });

    return String(result.text || "");
  }

  // DOCX
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({
      buffer,
    });

    return result.value;
  }

  // TXT
  if (
    file.type === "text/plain" ||
    fileName.endsWith(".txt")
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    "暂仅支持 PDF、DOCX 和 TXT 格式"
  );
}

export async function POST(req: Request) {
  try {
    // 1. 读取上传的表单
    const formData = await req.formData();

    // 2. 获取 resume 文件
    const file = formData.get("resume");

    if (!(file instanceof File)) {
      return Response.json(
        {
          success: false,
          error: "未收到简历文件",
        },
        {
          status: 400,
        }
      );
    }

    // 3. 文件大小限制：5MB
    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      return Response.json(
        {
          success: false,
          error: "简历文件不能超过 5MB",
        },
        {
          status: 400,
        }
      );
    }

    // 4. 从 PDF / DOCX / TXT 中提取纯文本
    const resumeText =
      await extractResumeText(file);

    if (
      !resumeText ||
      resumeText.trim().length < 50
    ) {
      return Response.json(
        {
          success: false,
          error:
            "未能从简历中读取足够的文字内容",
        },
        {
          status: 400,
        }
      );
    }

    // 5. 构造 Candidate Profile Prompt
    const prompt = `
你是 JobPilot 的简历解析模块。

你的任务是把候选人的原始简历转换成结构化 Candidate Profile。

重要规则：

1. 只能使用原始简历中明确存在的信息。
2. 严禁编造任何工作经历、技能、项目、公司、职位、时间、地点、数据指标或职责。
3. 不要因为某项技能与候选人经历“看起来相关”就自动添加。
4. 如果信息没有在简历中出现，返回空字符串或空数组。
5. 尽可能完整保留原始简历中的量化指标、工具、方法、业务结果。
6. 工作经历的 company 和 title 必须忠实于原始简历。
7. education 必须忠实于原始简历。
8. description 可以对原文进行简洁整理，但不得改变事实含义。
9. summary 是对候选人背景的简洁总结，可以生成，但必须完全建立在简历事实基础上。
10. 最终只返回合法 JSON。
11. 不要返回 Markdown。
12. 不要输出 JSON 之外的任何解释。

请严格返回以下结构：

{
  "name": "",
  "summary": "",
  "skills": [],
  "education": [
    {
      "school": "",
      "degree": "",
      "major": ""
    }
  ],
  "experience": [
    {
      "company": "",
      "title": "",
      "description": []
    }
  ],
  "projects": [
    {
      "name": "",
      "description": []
    }
  ]
}

以下是候选人的原始简历：

${resumeText}
`;

    // 6. 调用 OpenAI
    const response =
      await client.responses.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5-mini",
        input: prompt,
      });

    // 7. 获取模型输出
    const rawOutput =
      response.output_text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    // 8. 转成 JSON
    let profile;

    try {
      profile = JSON.parse(rawOutput);
    } catch {
      console.error(
        "Candidate Profile JSON 解析失败：",
        rawOutput
      );

      return Response.json(
        {
          success: false,
          error:
            "AI 返回的 Candidate Profile 格式不正确",
        },
        {
          status: 500,
        }
      );
    }

    // 9. 保存 Master Resume + Candidate Profile
    await saveCandidateStore({
      rawResumeText: resumeText,

      candidateProfile: profile,

      metadata: {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    // 10. 返回给 Chrome Extension
    return Response.json({
      success: true,

      file: {
        name: file.name,
        type: file.type,
        size: file.size,
      },

      textLength: resumeText.length,

      profile,
    });

  } catch (error: any) {
    console.error(
      "Resume processing error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          "简历处理失败",
      },
      {
        status: 500,
      }
    );
  }
}