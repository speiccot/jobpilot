"use client";

import {
  useEffect,
  useState,
} from "react";

type Application = {
  id: number;

  company: string;
  contactName: string;

  title: string;
  salary: string;
  location: string;
  url: string;

  jobFamily: string;
  roleType: string;
  seniority: string;
  industry: string;

  score: number;

  summary: string;

  topMatches: string[];

  mainGap: string;

  greetingMessage: string;

  recommendation: string;

  status: string;
};

export default function Home() {
  const [
    applications,
    setApplications,
  ] =
    useState<Application[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    skipThreshold,
    setSkipThreshold,
  ] =
    useState(60);

  const [
    greetThreshold,
    setGreetThreshold,
  ] =
    useState(80);

  const [
    settingsMessage,
    setSettingsMessage,
  ] =
    useState("");

  const [
    greetingMessage,
    setGreetingMessage,
  ] =
    useState("");

  // =========================
  // Applications
  // =========================

  async function loadApplications() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/applications"
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "读取职位记录失败"
        );
      }

      setApplications(
        data.applications ||
          []
      );

    } catch (error: any) {
      setError(
        error?.message ||
          "读取职位记录失败"
      );

    } finally {
      setLoading(false);
    }
  }

  // =========================
  // Settings
  // =========================

  async function loadSettings() {
    try {
      const response =
        await fetch(
          "/api/settings"
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.settings
      ) {
        setSkipThreshold(
          data.settings
            .skipThreshold
        );

        setGreetThreshold(
          data.settings
            .greetThreshold
        );
      }

    } catch {
      // 设置读取失败不影响 Dashboard
    }
  }

  async function saveSettings() {
    try {
      setSettingsMessage(
        "正在保存..."
      );

      const response =
        await fetch(
          "/api/settings",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                skipThreshold,
                greetThreshold,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "保存失败"
        );
      }

      setSettingsMessage(
        "设置已保存"
      );

      await loadApplications();

    } catch (error: any) {
      setSettingsMessage(
        error?.message ||
          "保存失败"
      );
    }
  }

  // =========================
  // Greeting Generator
  // =========================

  async function generateGreetings() {
    try {
      setGreetingMessage(
        "正在生成打招呼内容..."
      );

      const response =
        await fetch(
          "/api/greetings/generate",
          {
            method: "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "生成打招呼内容失败"
        );
      }

      setGreetingMessage(
        data.message ||
          `已生成 ${
            data.generated || 0
          } 条打招呼内容`
      );

      await loadApplications();

    } catch (error: any) {
      setGreetingMessage(
        error?.message ||
          "生成打招呼内容失败"
      );
    }
  }

  // =========================
  // Restore to Candidate Pool
  // =========================

  async function restoreJob(
    id: number
  ) {
    try {
      const response =
        await fetch(
          `/api/applications/${id}/restore`,
          {
            method: "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "恢复失败"
        );
      }

      await loadApplications();

    } catch (error: any) {
      alert(
        error?.message ||
          "恢复失败"
      );
    }
  }

  // =========================
  // Restore to Ready To Greet
  // =========================

  async function restoreToReady(
    id: number
  ) {
    try {
      const response =
        await fetch(
          `/api/applications/${id}/restore-ready`,
          {
            method: "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "恢复失败"
        );
      }

      await loadApplications();

    } catch (error: any) {
      alert(
        error?.message ||
          "恢复失败"
      );
    }
  }

  // =========================
  // Initial Load
  // =========================

  useEffect(() => {
    loadApplications();
    loadSettings();
  }, []);

  // =========================
  // KPI
  // =========================

  const scannedCount =
    applications.length;

  const skippedCount =
    applications.filter(
      (item) =>
        item.status ===
        "SKIPPED"
    ).length;

  const poolCount =
    applications.filter(
      (item) =>
        item.status ===
        "JOB_POOL"
    ).length;

  const readyToGreetCount =
    applications.filter(
      (item) =>
        item.status ===
        "READY_TO_GREET"
    ).length;

  const greetingReadyCount =
    applications.filter(
      (item) =>
        item.status ===
        "GREETING_READY"
    ).length;

  return (
    <main
      style={{
        maxWidth: 1300,
        margin:
          "40px auto",
        padding: 24,
      }}
    >
      {/* =====================
          Header
      ===================== */}

      <h1
        style={{
          fontSize: 40,
          marginBottom: 6,
        }}
      >
        JobPilot
      </h1>

      <p
        style={{
          color: "#666",
          marginBottom: 30,
        }}
      >
        AI 求职工作流管理
      </p>

      {/* =====================
          Settings
      ===================== */}

      <section
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 16,
          marginBottom: 24,

          boxShadow:
            "0 4px 20px rgba(0,0,0,.05)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          自动化设置
        </h2>

        <div
          style={{
            display: "flex",
            gap: 30,
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >
          <label>
            <div>
              低于多少分判定为不匹配
            </div>

            <input
              type="number"
              min={0}
              max={100}
              value={
                skipThreshold
              }
              onChange={(e) =>
                setSkipThreshold(
                  Number(
                    e.target.value
                  )
                )
              }
              style={{
                marginTop: 6,
                padding: 8,
                width: 100,
              }}
            />
          </label>

          <label>
            <div>
              达到多少分进入待生成开场白
            </div>

            <input
              type="number"
              min={0}
              max={100}
              value={
                greetThreshold
              }
              onChange={(e) =>
                setGreetThreshold(
                  Number(
                    e.target.value
                  )
                )
              }
              style={{
                marginTop: 6,
                padding: 8,
                width: 100,
              }}
            />
          </label>

          <button
            onClick={
              saveSettings
            }
            style={{
              padding:
                "9px 18px",
              cursor: "pointer",
            }}
          >
            保存设置
          </button>

          <span
            style={{
              fontSize: 13,
              color: "#666",
            }}
          >
            {settingsMessage}
          </span>
        </div>
      </section>

      {/* =====================
          KPI
      ===================== */}

      <div
        style={{
          display: "grid",

          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",

          gap: 16,

          marginBottom: 28,
        }}
      >
        <StatCard
          label="已扫描"
          value={
            scannedCount
          }
        />

        <StatCard
          label="不匹配"
          value={
            skippedCount
          }
        />

        <StatCard
          label="候选池"
          value={
            poolCount
          }
        />

        <StatCard
          label="待生成开场白"
          value={
            readyToGreetCount
          }
        />

        <StatCard
          label="已生成开场白待投递"
          value={
            greetingReadyCount
          }
        />
      </div>

      {/* =====================
          Header
      ===================== */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: 0,
          }}
        >
          职位列表
        </h2>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {greetingMessage && (
            <span
              style={{
                fontSize: 13,
                color: "#666",
              }}
            >
              {greetingMessage}
            </span>
          )}

          <button
            onClick={
              generateGreetings
            }
            style={{
              padding:
                "8px 14px",
              cursor: "pointer",
            }}
          >
            生成待处理开场白
          </button>

          <button
            onClick={
              loadApplications
            }
            style={{
              padding:
                "8px 14px",
              cursor: "pointer",
            }}
          >
            刷新
          </button>
        </div>
      </div>

      {/* =====================
          Loading / Error
      ===================== */}

      {loading && (
        <p>
          正在加载...
        </p>
      )}

      {error && (
        <p
          style={{
            color: "#b00020",
          }}
        >
          {error}
        </p>
      )}

      {!loading &&
        !error &&
        applications.length ===
          0 && (
          <p
            style={{
              color: "#777",
            }}
          >
            当前还没有扫描到职位。
          </p>
        )}

      {/* =====================
          Job Cards
      ===================== */}

      <div
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        {applications.map(
          (job) => (
            <JobCard
              key={job.id}

              job={job}

              onRestore={() =>
                restoreJob(
                  job.id
                )
              }

              onRestoreToReady={() =>
                restoreToReady(
                  job.id
                )
              }
            />
          )
        )}
      </div>
    </main>
  );
}

// =========================
// Job Card
// =========================

function JobCard({
  job,
  onRestore,
  onRestoreToReady,
}: {
  job: Application;
  onRestore: () => void;
  onRestoreToReady: () => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 20,

        boxShadow:
          "0 4px 16px rgba(0,0,0,.05)",
      }}
    >
      {/* Header */}

      <div
        style={{
          display: "flex",

          justifyContent:
            "space-between",

          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: "#777",
            }}
          >
            {job.company ||
              "公司未识别"}

            {" · "}

            {job.contactName ||
              "联系人未识别"}
          </div>

          <h3
            style={{
              margin:
                "7px 0",
            }}
          >
            {job.title}
          </h3>

          <div
            style={{
              color: "#666",
            }}
          >
            {job.salary}

            {job.location
              ? ` · ${job.location}`
              : ""}
          </div>
        </div>

        <div
          style={{
            textAlign:
              "right",
            minWidth: 110,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            {job.score}
          </div>

          <div>
            / 100
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 12,
            }}
          >
            {translateStatus(
              job.status
            )}
          </div>
        </div>
      </div>

      {/* Match Summary */}

      <div
        style={{
          marginTop: 18,
        }}
      >
        <strong>
          适配分析
        </strong>

        <p
          style={{
            lineHeight: 1.6,
          }}
        >
          {job.summary ||
            "暂无分析"}
        </p>
      </div>

      {/* Top Matches */}

      <div>
        <strong>
          核心匹配
        </strong>

        <ul>
          {job.topMatches
            ?.length >
          0 ? (
            job.topMatches.map(
              (
                item,
                index
              ) => (
                <li
                  key={
                    index
                  }
                >
                  {item}
                </li>
              )
            )
          ) : (
            <li>
              暂无
            </li>
          )}
        </ul>
      </div>

      {/* Main Gap */}

      {job.mainGap && (
        <div>
          <strong>
            主要缺口
          </strong>

          <p
            style={{
              lineHeight: 1.6,
            }}
          >
            {job.mainGap}
          </p>
        </div>
      )}

      {/* Greeting */}

      {job.greetingMessage && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            background:
              "#f7f7f7",
            borderRadius: 10,
          }}
        >
          <strong>
            推荐开场白
          </strong>

          <p
            style={{
              marginBottom: 0,
              lineHeight: 1.6,
            }}
          >
            {
              job.greetingMessage
            }
          </p>
        </div>
      )}

      {/* Metadata */}

      <div
        style={{
          fontSize: 13,
          color: "#777",
          marginTop: 16,
        }}
      >
        {job.roleType ||
          "Unknown"}

        {" · "}

        {job.industry ||
          "Unknown"}

        {" · "}

        {job.seniority ||
          "Unknown"}
      </div>

      {/* Actions */}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:
                "inline-block",

              padding:
                "8px 14px",

              border:
                "1px solid #ddd",

              borderRadius: 8,

              textDecoration:
                "none",

              color: "#222",

              cursor: "pointer",
            }}
          >
            查看原职位
          </a>
        )}

        {/* 不匹配 */}

        {job.status ===
          "SKIPPED" && (
          <>
            <button
              onClick={
                onRestore
              }
              style={{
                padding:
                  "8px 14px",
                cursor:
                  "pointer",
              }}
            >
              恢复到候选池
            </button>

            <button
              onClick={
                onRestoreToReady
              }
              style={{
                padding:
                  "8px 14px",
                cursor:
                  "pointer",
              }}
            >
              恢复到待生成开场白
            </button>
          </>
        )}

        {/* 候选池 */}

        {job.status ===
          "JOB_POOL" && (
          <button
            onClick={
              onRestoreToReady
            }
            style={{
              padding:
                "8px 14px",
              cursor: "pointer",
            }}
          >
            恢复到待生成开场白
          </button>
        )}
      </div>
    </div>
  );
}

// =========================
// KPI Card
// =========================

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: 20,

        boxShadow:
          "0 4px 16px rgba(0,0,0,.05)",
      }}
    >
      <div
        style={{
          color: "#777",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// =========================
// Status Translation
// =========================

function translateStatus(
  status: string
) {
  if (
    status ===
    "SKIPPED"
  ) {
    return "不匹配";
  }

  if (
    status ===
    "JOB_POOL"
  ) {
    return "候选池";
  }

  if (
    status ===
    "READY_TO_GREET"
  ) {
    return "待生成开场白";
  }

  if (
    status ===
    "GREETING_READY"
  ) {
    return "已生成开场白待投递";
  }

  if (
    status ===
    "GREETING_SENT"
  ) {
    return "已打招呼";
  }

  if (
    status ===
    "REPLIED"
  ) {
    return "招聘者已回复";
  }

  if (
    status ===
    "RESUME_READY"
  ) {
    return "定制简历已生成";
  }

  if (
    status ===
    "RESUME_SENT"
  ) {
    return "简历已投递";
  }

  return status;
}