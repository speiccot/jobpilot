import mammoth from "mammoth";
import {
  extractText,
  getDocumentProxy,
} from "unpdf";

export const runtime = "nodejs";

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

    // 文件大小限制：5MB
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

    return Response.json({
      success: true,

      file: {
        name: file.name,
        type: file.type,
        size: file.size,
      },

      textLength: resumeText.length,

      // 暂时返回前 1000 个字符方便测试
      preview: resumeText.slice(0, 1000),
    });

  } catch (error: any) {
    console.error(
      "Resume parsing error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          "简历解析失败",
      },
      {
        status: 500,
      }
    );
  }
}