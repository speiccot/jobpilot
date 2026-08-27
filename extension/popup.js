const $ = (id) =>
  document.getElementById(id);

// =========================
// 通用列表渲染
// =========================

function fillList(id, items) {
  const el = $(id);

  if (!el) return;

  el.innerHTML = "";

  for (const item of items || []) {
    const li =
      document.createElement("li");

    li.textContent = item;

    el.appendChild(li);
  }

  if (!items?.length) {
    const li =
      document.createElement("li");

    li.textContent = "暂无";

    el.appendChild(li);
  }
}

function fillSimpleList(
  id,
  items
) {
  const el = $(id);

  if (!el) return;

  el.innerHTML = "";

  if (
    !items ||
    items.length === 0
  ) {
    const li =
      document.createElement("li");

    li.textContent = "暂无";

    el.appendChild(li);

    return;
  }

  for (const item of items) {
    const li =
      document.createElement("li");

    li.textContent = item;

    el.appendChild(li);
  }
}

// =========================
// 获取当前标签页
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

  return tab;
}

// =========================
// 从 BOSS 当前职位读取 Job
// 如果 content.js 没注入，就自动注入
// =========================

async function extractCurrentJob(
  tabId
) {
  let extracted;

  try {
    extracted =
      await chrome.tabs.sendMessage(
        tabId,
        {
          type:
            "JOBPILOT_EXTRACT",
        }
      );
  } catch (error) {
    // 当前页面没有 content.js
    // 自动注入
    await chrome.scripting.executeScript({
      target: {
        tabId,
      },

      files: [
        "content.js",
      ],
    });

    // 注入完成后再请求一次
    extracted =
      await chrome.tabs.sendMessage(
        tabId,
        {
          type:
            "JOBPILOT_EXTRACT",
        }
      );
  }

  if (
    !extracted ||
    !extracted.success
  ) {
    throw new Error(
      extracted?.error ||
      "无法读取当前职位"
    );
  }

  return extracted.job;
}

// =========================
// 分析当前职位
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
      // 1. 当前标签页
      const tab =
        await getCurrentTab();

      // 2. 必须是 BOSS 页面
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

      // 3. 提取当前职位
      const job =
        await extractCurrentJob(
          tab.id
        );

      if (!job?.title) {
        throw new Error(
          "未识别到职位名称"
        );
      }

      if (!job?.jd) {
        throw new Error(
          "未识别到职位描述"
        );
      }

      if (!job?.jobId) {
        throw new Error(
          "未识别到岗位唯一 ID"
        );
      }

      // 4. 发给后端分析
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
              JSON.stringify(
                job
              ),
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

      // 5. 更新 UI
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

      // 6. 状态提示
      const companyText =
        job.company ||
        "公司未识别";

      const contactText =
        job.contactName ||
        "联系人未识别";

      if (status) {
        status.textContent =
          `分析完成：${companyText} · ${contactText}`;
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
// 复制开场白
// =========================

$("copy")?.addEventListener(
  "click",
  async () => {
    const message =
      $("message")?.textContent ||
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
// 上传 Resume
// =========================

$("uploadResume")?.addEventListener(
  "click",
  async () => {
    const fileInput =
      $("resumeFile");

    const status =
      $("resumeStatus");

    if (!fileInput) {
      return;
    }

    const file =
      fileInput.files?.[0];

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

      // =====================
      // Candidate Profile UI
      // =====================

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
        ).map((item) => {
          return [
            item.school,
            item.degree,
            item.major,
          ]
            .filter(Boolean)
            .join(" · ");
        })
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
            item.name || ""
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

// =========================
// 临时 Debug
// 只扫描当前职位详情
// =========================

// $("debugDom")?.addEventListener(
//   "click",
//   async () => {
//     const debugResult =
//       $("debugResult");

//     if (!debugResult) {
//       return;
//     }

//     debugResult.style.display =
//       "block";

//     debugResult.textContent =
//       "正在扫描当前职位详情...";

//     try {
//       const tab =
//         await getCurrentTab();

//       if (
//         !tab.url ||
//         !tab.url.includes(
//           "zhipin.com"
//         )
//       ) {
//         throw new Error(
//           "请先打开 BOSS 直聘职位页面"
//         );
//       }

//       const results =
//         await chrome.scripting.executeScript({
//           target: {
//             tabId: tab.id,
//           },

//           func: () => {
//             function clean(
//               text
//             ) {
//               return (
//                 text || ""
//               )
//                 .replace(
//                   /\s+/g,
//                   " "
//                 )
//                 .trim();
//             }

//             const detail =
//               document.querySelector(
//                 ".job-detail-container"
//               );

//             if (!detail) {
//               return {
//                 error:
//                   "没有找到当前职位详情区域",
//               };
//             }

//             const items = [];

//             const elements =
//               detail.querySelectorAll(
//                 "a, span, div, p, h1, h2, h3"
//               );

//             for (
//               const el of elements
//             ) {
//               const text =
//                 clean(
//                   el.innerText ||
//                   el.textContent ||
//                   ""
//                 );

//               if (!text) {
//                 continue;
//               }

//               if (
//                 text.length > 100
//               ) {
//                 continue;
//               }

//               const className =
//                 typeof el.className ===
//                 "string"
//                   ? el.className
//                   : "";

//               const href =
//                 el.tagName === "A"
//                   ? el.href || ""
//                   : "";

//               const dataset = {
//                 ...el.dataset,
//               };

//               items.push({
//                 tag:
//                   el.tagName,

//                 text,

//                 className,

//                 href,

//                 dataset,
//               });

//               if (
//                 items.length >=
//                 120
//               ) {
//                 break;
//               }
//             }

//             return {
//               url:
//                 window.location.href,

//               detailClass:
//                 detail.className,

//               items,
//             };
//           },
//         });

//       const data =
//         results?.[0]?.result;

//       if (!data) {
//         throw new Error(
//           "无法读取当前职位详情"
//         );
//       }

//       if (data.error) {
//         throw new Error(
//           data.error
//         );
//       }

//       const output = [
//         `URL：${data.url}`,
//         "",
//         `详情容器：${data.detailClass}`,
//         "",
//         "当前职位详情内部元素：",
//         "",

//         ...data.items.map(
//           (
//             item,
//             index
//           ) =>
//             `${index + 1}.

// 文本：${item.text}

// 标签：${item.tag}

// class：${item.className}

// 链接：${item.href || "无"}

// data属性：${JSON.stringify(
//               item.dataset
//             )}

// --------------------`
//         ),
//       ].join("\n");

//       debugResult.textContent =
//         output;

//     } catch (error) {
//       debugResult.textContent =
//         `扫描失败：${error.message}`;
//     }
//   }
// );