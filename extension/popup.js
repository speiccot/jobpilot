const $ = (id) =>
  document.getElementById(
    id
  );

// =========================
// List rendering
// =========================

function fillList(
  id,
  items
) {
  const el = $(id);

  if (!el) return;

  el.innerHTML = "";

  if (!items?.length) {
    const li =
      document.createElement(
        "li"
      );

    li.textContent =
      "暂无";

    el.appendChild(li);

    return;
  }

  for (const item of items) {
    const li =
      document.createElement(
        "li"
      );

    li.textContent =
      item;

    el.appendChild(li);
  }
}

function fillSimpleList(
  id,
  items
) {
  fillList(
    id,
    items
  );
}

// =========================
// Current Tab
// =========================

async function getCurrentTab() {
  const [tab] =
    await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

  if (!tab?.id) {
    throw new Error(
      "无法获取当前标签页"
    );
  }

  if (
    !tab.url ||
    !tab.url.includes(
      "zhipin.com"
    )
  ) {
    throw new Error(
      "请先打开 BOSS 直聘职位页面"
    );
  }

  return tab;
}

// =========================
// Ensure content.js
// =========================

async function ensureContentScript(
  tabId
) {
  try {
    await chrome.tabs.sendMessage(
      tabId,
      {
        type:
          "JOBPILOT_GET_JOB_COUNT",
      }
    );

    return;

  } catch {
    await chrome.scripting
      .executeScript({
        target: {
          tabId,
        },

        files: [
          "content.js",
        ],
      });

    // 给脚本注入一点时间
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          200
        )
    );
  }
}

// =========================
// Single Fast Match
// =========================

async function analyzeJob(
  job
) {
  const response =
    await fetch(
      "http://localhost:3001/api/analyze",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(job),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "职位分析失败"
    );
  }

  return data;
}

// =========================
// Single Job Analyze
// =========================

$("analyze")
  ?.addEventListener(
    "click",
    async () => {
      const status =
        $("status");

      const result =
        $("result");

      if (status) {
        status.textContent =
          "正在读取当前职位并分析...";
      }

      if (result) {
        result.style.display =
          "none";
      }

      try {
        const tab =
          await getCurrentTab();

        await ensureContentScript(
          tab.id
        );

        const extracted =
          await chrome.tabs
            .sendMessage(
              tab.id,
              {
                type:
                  "JOBPILOT_EXTRACT",
              }
            );

        if (
          !extracted?.success
        ) {
          throw new Error(
            extracted?.error ||
            "无法读取当前职位"
          );
        }

        const job =
          extracted.job;

        const data =
          await analyzeJob(
            job
          );

        if ($("score")) {
          $("score").textContent =
            data.score ?? 0;
        }

        if ($("rec")) {
          $("rec").textContent =
            data.recommendation ||
            "未知";
        }

        if ($("role")) {
          $("role").textContent =
            data.roleType ||
            "未识别";
        }

        // Fast Match 新结构
        fillList(
          "reasons",
          data.topMatches ||
            []
        );

        fillList(
          "risks",
          data.mainGap
            ? [
                data.mainGap,
              ]
            : []
        );

        if ($("message")) {
          $("message")
            .textContent =
            data.summary ||
            "暂无适配分析";
        }

        if (result) {
          result.style.display =
            "block";
        }

        if (status) {
          status.textContent =
            `分析完成：${
              job.company ||
              "公司未识别"
            } · ${
              job.contactName ||
              "联系人未识别"
            }`;
        }

      } catch (error) {
        if (status) {
          status.textContent =
            `失败：${error.message}`;
        }
      }
    }
  );

// =========================
// Infinite Batch Scan
// =========================

$("batchScan")
  ?.addEventListener(
    "click",
    async () => {
      const batchStatus =
        $("batchStatus");

      const button =
        $("batchScan");

      if (!batchStatus) {
        return;
      }

      try {
        button.disabled =
          true;

        const tab =
          await getCurrentTab();

        await ensureContentScript(
          tab.id
        );

        // =====================
        // 用户扫描数量
        // =====================

        const requestedCount =
          Number(
            $("scanCount")
              ?.value ||
            10
          );

        if (
          !Number.isInteger(
            requestedCount
          ) ||
          requestedCount < 1
        ) {
          throw new Error(
            "扫描数量必须是大于 0 的整数"
          );
        }

        const targetCount =
          Math.min(
            requestedCount,
            300
          );

        batchStatus.textContent =
          `准备扫描 ${targetCount} 个职位...`;

        // =====================
        // PHASE 1
        // Infinite Extraction
        // =====================

        const scanResult =
          await chrome.tabs
            .sendMessage(
              tab.id,
              {
                type:
                  "JOBPILOT_COLLECT_JOBS",

                targetCount,
              }
            );

        if (
          !scanResult?.success
        ) {
          throw new Error(
            scanResult?.error ||
            "职位提取失败"
          );
        }

        const jobs =
          scanResult.jobs ||
          [];

        if (
          jobs.length === 0
        ) {
          throw new Error(
            "没有成功提取任何职位"
          );
        }

        if (
          scanResult
            .reachedTarget
        ) {
          batchStatus.textContent =
            `已成功提取 ${jobs.length} / ${targetCount} 个职位，正在批量匹配...`;

        } else {
          batchStatus.textContent =
            `当前搜索结果只成功获取 ${jobs.length} 个职位，正在匹配这些职位...`;
        }

        // =====================
        // PHASE 2
        // Token-aware Batch Match
        // =====================

        const response =
          await fetch(
            "http://localhost:3001/api/analyze/batch",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  jobs,
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
            "批量匹配失败"
          );
        }

        // =====================
        // Final Result
        // =====================

        const targetMessage =
          scanResult
            .reachedTarget
            ? ""
            : `；未达到目标 ${targetCount} 个`;

        batchStatus.textContent =
          `完成：提取 ${jobs.length} 个${targetMessage}；新分析 ${data.analyzed} 个；已存在跳过 ${data.skippedExisting} 个；LLM Batch ${data.batchCount} 个`;

      } catch (error) {
        batchStatus.textContent =
          `批量扫描失败：${error.message}`;

      } finally {
        button.disabled =
          false;
      }
    }
  );

// =========================
// Copy
// =========================

$("copy")
  ?.addEventListener(
    "click",
    async () => {
      const message =
        $("message")
          ?.textContent ||
        "";

      if (!message) {
        return;
      }

      try {
        await navigator.clipboard
          .writeText(
            message
          );

        $("copy").textContent =
          "已复制";

        setTimeout(
          () => {
            if ($("copy")) {
              $("copy")
                .textContent =
                "复制内容";
            }
          },
          1500
        );

      } catch {
        $("copy").textContent =
          "复制失败";
      }
    }
  );

// =========================
// Resume Upload
// =========================

$("uploadResume")
  ?.addEventListener(
    "click",
    async () => {
      const fileInput =
        $("resumeFile");

      const status =
        $("resumeStatus");

      const file =
        fileInput
          ?.files?.[0];

      if (!file) {
        if (status) {
          status.textContent =
            "请先选择一份简历";
        }

        return;
      }

      if (status) {
        status.textContent =
          "正在上传并分析简历...";
      }

      try {
        const formData =
          new FormData();

        formData.append(
          "resume",
          file
        );

        const response =
          await fetch(
            "http://localhost:3001/api/resume",
            {
              method:
                "POST",

              body:
                formData,
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
            "简历上传失败"
          );
        }

        if (status) {
          status.textContent =
            `✓ ${data.file.name} 分析完成，已生成候选人画像`;
        }

        const profile =
          data.profile;

        if (!profile) {
          return;
        }

        if (
          $("profileName")
        ) {
          $("profileName")
            .textContent =
            profile.name ||
            "未识别";
        }

        if (
          $("profileSummary")
        ) {
          $("profileSummary")
            .textContent =
            profile.summary ||
            "暂无";
        }

        if (
          $("profileSkills")
        ) {
          $("profileSkills")
            .textContent =
            (
              profile.skills ||
              []
            ).join(" · ") ||
            "暂无";
        }

        fillSimpleList(
          "profileExperience",

          (
            profile.experience ||
            []
          ).map(
            (item) => {
              const descriptions =
                (
                  item.description ||
                  []
                ).join(
                  "；"
                );

              return `${
                item.title ||
                ""
              } @ ${
                item.company ||
                ""
              }${
                descriptions
                  ? `：${descriptions}`
                  : ""
              }`;
            }
          )
        );

        fillSimpleList(
          "profileEducation",

          (
            profile.education ||
            []
          ).map(
            (item) =>
              [
                item.school,
                item.degree,
                item.major,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " · "
                )
          )
        );

        fillSimpleList(
          "profileProjects",

          (
            profile.projects ||
            []
          ).map(
            (item) => {
              const descriptions =
                (
                  item.description ||
                  []
                ).join(
                  "；"
                );

              return `${
                item.name ||
                ""
              }${
                descriptions
                  ? `：${descriptions}`
                  : ""
              }`;
            }
          )
        );

        if (
          $("profilePreview")
        ) {
          $("profilePreview")
            .style.display =
            "block";
        }

      } catch (error) {
        if (status) {
          status.textContent =
            `上传失败：${error.message}`;
        }
      }
    }
  );