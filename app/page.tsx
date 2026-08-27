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

  jobFamily: string;
  roleType: string;
  seniority: string;
  industry: string;

  score: number;

  summary: string;

  topMatches: string[];

  mainGap: string;

  recommendation: string;
  url: string;

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
      // Settings 读取失败
      // 不影响 Dashboard 主体
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

  useEffect(() => {
    loadApplications();
    loadSettings();
  }, []);

  const scannedCount =
    applications.length;

  const readyCount =
    applications.filter(
      (item) =>
        item.status ===
        "READY_TO_GREET"
    ).length;

  const poolCount =
    applications.filter(
      (item) =>
        item.status ===
        "JOB_POOL"
    ).length;

  const skippedCount =
    applications.filter(
      (item) =>
        item.status ===
        "SKIPPED"
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

      {/* Settings */}

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
        <h2>
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
              低于多少分自动跳过
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
              达到多少分进入打招呼队列
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

          <span>
            {settingsMessage}
          </span>
        </div>
      </section>

      {/* KPIs */}

      <div
        style={{
          display: "grid",

          gridTemplateColumns:
            "repeat(4,1fr)",

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
          label="待打招呼"
          value={
            readyCount
          }
        />

        <StatCard
          label="职位池"
          value={
            poolCount
          }
        />

        <StatCard
          label="已跳过"
          value={
            skippedCount
          }
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          marginBottom: 16,
        }}
      >
        <h2>
          职位池
        </h2>

        <button
          onClick={
            loadApplications
          }
        >
          刷新
        </button>
      </div>

      {loading && (
        <p>
          正在加载...
        </p>
      )}

      {error && (
        <p>
          {error}
        </p>
      )}

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
            />
          )
        )}
      </div>
    </main>
  );
}

function JobCard({
  job,
  onRestore,
}: {
  job: Application;
  onRestore: () => void;
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
                <li key={index}>
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

      {job.mainGap && (
        <div>
          <strong>
            主要缺口
          </strong>

          <p>
            {job.mainGap}
          </p>
        </div>
      )}

      <div
        style={{
          fontSize: 13,
          color: "#777",
          marginTop: 12,
        }}
      >
        {job.roleType}
        {" · "}
        {job.industry}
        {" · "}
        {job.seniority}
      </div>
      {job.url && (
  <a
    href={job.url}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "inline-block",
      marginTop: 16,
      marginRight: 10,
      padding: "8px 14px",
      border: "1px solid #ddd",
      borderRadius: 8,
      textDecoration: "none",
      color: "#222",
    }}
  >
    查看原职位
  </a>
)}
      {job.status ===
        "SKIPPED" && (
        <button
          onClick={
            onRestore
          }
          style={{
            marginTop: 16,
            padding:
              "8px 14px",
            cursor: "pointer",
          }}
        >
          恢复到职位池
        </button>
      )}
    </div>
  );
}

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

function translateStatus(
  status: string
) {
  if (
    status ===
    "READY_TO_GREET"
  ) {
    return "待打招呼";
  }

  if (
    status ===
    "JOB_POOL"
  ) {
    return "职位池";
  }

  if (
    status ===
    "SKIPPED"
  ) {
    return "已跳过";
  }

  if (
    status ===
    "GREETING_SENT"
  ) {
    return "已打招呼";
  }

  return status;
}