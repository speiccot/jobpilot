const $ = (id) =>
  document.getElementById(id);

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

  for (
    const item of items
  ) {
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
// Current tab
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
// 确保 content.js 存在
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
    await chrome.scripting.executeScript({
      target: {
        tabId,
      },

      files: [
        "content.js",
      ],
    });
  }
}

// =========================
// Analyze API
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
// 单职位分析
// =========================

$("analyze")?.addEventListener(
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
        await chrome.tabs.sendMessage(
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

      fillList(
        "reasons",
        data.reasons
      );

      fillList(
        "risks",
        data.risks
      );

      if ($("message")) {
        $("message").textContent =
          data.openingMessage ||
          "暂无推荐开场白";
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
// Batch Scan
// =========================

$("batchScan")?.addEventListener(
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

      // 获取当前列表职位数量
      const countResult =
        await chrome.tabs.sendMessage(
          tab.id,
          {
            type:
              "JOBPILOT_GET_JOB_COUNT",
          }
        );

      if (
        !countResult?.success
      ) {
        throw new Error(
          "无法读取职位列表"
        );
      }

      const requestedCount =
  Number(
    $("scanCount")
      ?.value || 10
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

const safeRequestedCount =
  Math.min(
    requestedCount,
    300
  );

const scanCount =
  Math.min(
    safeRequestedCount,
    countResult.count
  );

      if (
        scanCount === 0
      ) {
        throw new Error(
          "当前页面未找到可扫描职位"
        );
      }

      let successCount = 0;
      let failedCount = 0;

      let applyCount = 0;
      let maybeCount = 0;
      let skipCount = 0;

      const scannedJobIds =
        new Set();

      for (
        let index = 0;
        index < scanCount;
        index++
      ) {
        batchStatus.textContent =
          `正在扫描 ${
            index + 1
          } / ${scanCount} ...`;

        try {
          // 点击职位并拿到右侧完整 Job
          const selected =
            await chrome.tabs.sendMessage(
              tab.id,
              {
                type:
                  "JOBPILOT_SELECT_JOB",

                index,
              }
            );

          if (
            !selected?.success
          ) {
            throw new Error(
              selected?.error ||
              "职位读取失败"
            );
          }

          const job =
            selected.job;

          // 当前批次内部去重
          if (
            scannedJobIds.has(
              job.jobId
            )
          ) {
            continue;
          }

          scannedJobIds.add(
            job.jobId
          );

          batchStatus.textContent =
            `正在分析 ${
              index + 1
            } / ${scanCount}：${
              job.company ||
              ""
            } ${
              job.title ||
              ""
            }`;

          const analysis =
            await analyzeJob(
              job
            );

          successCount++;

          if (
            analysis.recommendation ===
            "apply"
          ) {
            applyCount++;
          } else if (
            analysis.recommendation ===
            "maybe"
          ) {
            maybeCount++;
          } else {
            skipCount++;
          }

          // 给页面一点缓冲
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                400
              )
          );

        } catch (error) {
          console.error(
            `扫描第 ${
              index + 1
            } 个职位失败：`,
            error
          );

          failedCount++;
        }
      }

      batchStatus.textContent =
        `扫描完成：成功 ${successCount} 个，失败 ${failedCount} 个；建议 ${applyCount}，考虑 ${maybeCount}，跳过 ${skipCount}`;

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
// Copy greeting
// =========================

$("copy")?.addEventListener(
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
      await navigator.clipboard.writeText(
        message
      );

      $("copy").textContent =
        "已复制";

      setTimeout(() => {
        if ($("copy")) {
          $("copy").textContent =
            "复制开场白";
        }
      }, 1500);

    } catch {
      $("copy").textContent =
        "复制失败";
    }
  }
);

// =========================
// Resume Upload
// =========================

$("uploadResume")?.addEventListener(
  "click",
  async () => {
    const fileInput =
      $("resumeFile");

    const status =
      $("resumeStatus");

    const file =
      fileInput?.files?.[0];

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
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
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

      if ($("profileName")) {
        $("profileName").textContent =
          profile.name ||
          "未识别";
      }

      if ($("profileSummary")) {
        $("profileSummary").textContent =
          profile.summary ||
          "暂无";
      }

      if ($("profileSkills")) {
        $("profileSkills").textContent =
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
        ).map((item) => {
          const descriptions =
            (
              item.description ||
              []
            ).join("；");

          return `${
            item.title || ""
          } @ ${
            item.company || ""
          }${
            descriptions
              ? `：${descriptions}`
              : ""
          }`;
        })
      );

      fillSimpleList(
        "profileEducation",

        (
          profile.education ||
          []
        ).map((item) =>
          [
            item.school,
            item.degree,
            item.major,
          ]
            .filter(Boolean)
            .join(" · ")
        )
      );

      fillSimpleList(
        "profileProjects",

        (
          profile.projects ||
          []
        ).map((item) => {
          const descriptions =
            (
              item.description ||
              []
            ).join("；");

          return `${
            item.name ||
            ""
          }${
            descriptions
              ? `：${descriptions}`
              : ""
          }`;
        })
      );

      if ($("profilePreview")) {
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