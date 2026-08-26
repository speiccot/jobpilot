import fs from "fs/promises";
import path from "path";

export type CandidateStore = {
  rawResumeText: string;

  candidateProfile: {
    name: string;
    summary: string;
    skills: string[];

    education: {
      school: string;
      degree?: string;
      major?: string;
    }[];

    experience: {
      company: string;
      title: string;
      description: string[];
    }[];

    projects: {
      name: string;
      description: string[];
    }[];
  };

  metadata: {
    fileName: string;
    uploadedAt: string;
  };
};

const STORE_PATH = path.join(
  process.cwd(),
  "data",
  "candidate.json"
);

export async function saveCandidateStore(
  data: CandidateStore
) {
  await fs.mkdir(
    path.dirname(STORE_PATH),
    { recursive: true }
  );

  await fs.writeFile(
    STORE_PATH,
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

export async function loadCandidateStore():
  Promise<CandidateStore | null> {
  try {
    const raw = await fs.readFile(
      STORE_PATH,
      "utf-8"
    );

    return JSON.parse(raw);
  } catch {
    return null;
  }
}