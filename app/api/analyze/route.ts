import OpenAI from "openai";
import { z } from "zod";
import { candidateProfile } from "../../../lib/profile";

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
    const payload = RequestSchema.parse(await req.json());

    const prompt = `
You are JobPilot, an AI job-search copilot.

Candidate profile:
${JSON.stringify(candidateProfile, null, 2)}

Job:
${JSON.stringify(payload, null, 2)}

Return ONLY valid JSON in exactly this shape:
{
  "score": 0,
  "recommendation": "apply",
  "roleType": "AI Product Manager",
  "reasons": ["", "", ""],
  "risks": [],
  "openingMessage": ""
}

Requirements:
- score must be an integer from 0 to 100.
- recommendation must be one of: apply, maybe, skip.
- roleType must be one of: AI Product Manager, Data Scientist, AI Engineer, Other.
- reasons: exactly 3 concise Chinese strings.
- risks: 0 to 3 concise Chinese strings.
- openingMessage: natural Chinese recruiter greeting, preferably under 120 Chinese characters.
- Penalize obvious insurance sales, pure commission sales, MLM-like recruiting, or materially unrelated roles.
- Do not invent candidate experience.
- Prefer matching the strongest relevant experience to this exact JD.
`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: prompt,
    });

    const text = response.output_text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    return Response.json(JSON.parse(text));
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Analyze failed" },
      { status: 400 }
    );
  }
}
