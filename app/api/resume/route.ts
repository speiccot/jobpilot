import OpenAI from "openai";
import mammoth from "mammoth";
import {
  extractText,
  getDocumentProxy,
} from "unpdf";

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
    const formData = await req.formData();

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

    // 1. 提取简历文本
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

    // 2. 构造 Resume Parser Prompt
    const prompt = `
你是 JobPilot 的简历解析模块。

你的任务是把候选人的简历转换成结构化 Candidate Profile。

重要规则：

1. 只能使用简历中明确存在的信息。
2. 严禁编造任何工作经历、技能、项目、公司、职位、数据指标或职责。
3. 不要根据常识补全候选人没有写过的经历。
4. 如果某个字段不存在，可以返回空字符串或空数组。
5. 尽可能保留原简历中的量化指标。
6. skills 中只放简历明确提到，或可以从明确工作内容直接确认的技能。
7. 所有 description 保持简洁，但保留核心业务内容、方法和结果。
8. 最终只返回合法 JSON。
9. 不要返回 Markdown。
10. 不要输出 JSON 以外的任何解释。

请严格返回下面的数据结构：

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

    // 3. 调用 OpenAI
    const response =
      await client.responses.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5-mini",
        input: prompt,
      });

    // 4. 获取模型输出
    const rawOutput =
      response.output_text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    // 5. 转成 JSON
    let profile;

    try {
      profile = JSON.parse(rawOutput);
    } catch {
      console.error(
        "Invalid profile JSON:",
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

    // 6. 返回给 Chrome Extension
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