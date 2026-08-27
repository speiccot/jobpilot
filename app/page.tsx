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

  skills: string[];

  score: number;

  recommendation: string;

  matchReasons: string[];
  risks: string[];

  greetingMessage: string;

  status: string;

  createdAt: string;
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
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

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

  useEffect(() => {
    loadApplications();
  }, []);

  const analyzedCount =
    applications.length;

  const applyCount =
    applications.filter(
      (item) =>
        item.recommendation ===
        "apply"
    ).length;

  const maybeCount =
    applications.filter(
      (item) =>
        item.recommendation ===
        "maybe"
    ).length;

  const averageScore =
    applications.length > 0
      ? Math.round(
          applications.reduce(
            (sum, item) =>
              sum +
              item.score,
            0
          ) /
            applications.length
        )
      : 0;

  return (
    <main
      style={{
        maxWidth: 1400,
        margin:
          "50px auto",
        padding: 24,
      }}
    >
      <div
        style={{
          marginBottom: 32,
        }}
      >
        <h1
          style={{
            fontSize: 40,
            marginBottom: 8,
          }}
        >
          JobPilot
        </h1>

        <p
          style={{
            color: "#666",
            fontSize: 17,
          }}
        >
          AI 求职工作流管理
        </p>
      </div>

      <div
        style={{
          display: "grid",

          gridTemplateColumns:
            "repeat(4, 1fr)",

          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          label="已分析职位"
          value={
            analyzedCount
          }
        />

        <StatCard
          label="建议投递"
          value={
            applyCount
          }
        />

        <StatCard
          label="考虑投递"
          value={
            maybeCount
          }
        />

        <StatCard
          label="平均匹配度"
          value={
            averageScore
          }
        />
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          overflowX: "auto",

          boxShadow:
            "0 4px 20px rgba(0,0,0,.06)",
        }}
      >
        <div
          style={{
            padding: 20,

            borderBottom:
              "1px solid #eee",

            display: "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",
          }}
        >
          <h2
            style={{
              margin: 0,
            }}
          >
            职位记录
          </h2>

          <button
            onClick={
              loadApplications
            }
            style={{
              border: "none",

              padding:
                "8px 14px",

              borderRadius: 8,

              cursor:
                "pointer",
            }}
          >
            刷新
          </button>
        </div>

        {loading && (
          <div
            style={{
              padding: 30,
            }}
          >
            正在加载...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 30,
            }}
          >
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          applications.length ===
            0 && (
            <div
              style={{
                padding: 30,
                color: "#666",
              }}
            >
              暂无职位记录
            </div>
          )}

        {!loading &&
          applications.length >
            0 && (
            <table
              style={{
                width: "100%",

                minWidth: 1200,

                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr>
                  <Th>公司</Th>

                  <Th>
                    联系人
                  </Th>

                  <Th>职位</Th>

                  <Th>
                    职位类别
                  </Th>

                  <Th>行业</Th>

                  <Th>
                    Seniority
                  </Th>

                  <Th>
                    匹配度
                  </Th>

                  <Th>推荐</Th>

                  <Th>状态</Th>
                </tr>
              </thead>

              <tbody>
                {applications.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }

                      style={{
                        borderTop:
                          "1px solid #eee",
                      }}
                    >
                      <Td>
                        {item.company ||
                          "未识别"}
                      </Td>

                      <Td>
                        {item.contactName ||
                          "未识别"}
                      </Td>

                      <Td>
                        <div
                          style={{
                            fontWeight:
                              600,
                          }}
                        >
                          {
                            item.title
                          }
                        </div>

                        {item.salary && (
                          <div
                            style={{
                              color:
                                "#666",

                              fontSize:
                                12,

                              marginTop:
                                4,
                            }}
                          >
                            {
                              item.salary
                            }
                          </div>
                        )}
                      </Td>

                      <Td>
                        <div>
                          {
                            item.roleType
                          }
                        </div>

                        <div
                          style={{
                            fontSize:
                              12,

                            color:
                              "#777",

                            marginTop:
                              4,
                          }}
                        >
                          {
                            item.jobFamily
                          }
                        </div>
                      </Td>

                      <Td>
                        {
                          item.industry
                        }
                      </Td>

                      <Td>
                        {
                          item.seniority
                        }
                      </Td>

                      <Td>
                        <strong>
                          {
                            item.score
                          }
                        </strong>
                        /100
                      </Td>

                      <Td>
                        <RecommendationBadge
                          value={
                            item.recommendation
                          }
                        />
                      </Td>

                      <Td>
                        {
                          item.status
                        }
                      </Td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;

  value:
    | number
    | string;
}) {
  return (
    <div
      style={{
        background: "#fff",

        borderRadius: 14,

        padding: 20,

        boxShadow:
          "0 4px 20px rgba(0,0,0,.05)",
      }}
    >
      <div
        style={{
          color: "#777",
          fontSize: 14,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 32,

          fontWeight: 700,

          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <th
      style={{
        textAlign: "left",

        padding: 14,

        fontSize: 13,

        color: "#666",

        background:
          "#fafafa",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: 14,

        verticalAlign:
          "top",

        fontSize: 14,
      }}
    >
      {children}
    </td>
  );
}

function RecommendationBadge({
  value,
}: {
  value: string;
}) {
  let text = value;

  if (
    value === "apply"
  ) {
    text = "建议";
  }

  if (
    value === "maybe"
  ) {
    text = "考虑";
  }

  if (
    value === "skip"
  ) {
    text = "跳过";
  }

  return (
    <span
      style={{
        padding:
          "4px 8px",

        borderRadius: 999,

        background:
          "#eee",

        fontSize: 12,
      }}
    >
      {text}
    </span>
  );
}