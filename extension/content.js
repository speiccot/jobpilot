function clean(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function textWithin(root, selector) {
  if (!root) {
    return "";
  }

  const el = root.querySelector(selector);

  return clean(
    el?.innerText ||
      el?.textContent ||
      ""
  );
}

// =========================
// BOSS 薪资解码
// =========================

function decodeBossSalary(text) {
  const salaryMap = {
    "\uE031": "0",
    "\uE032": "1",
    "\uE033": "2",
    "\uE034": "3",
    "\uE035": "4",
    "\uE036": "5",
    "\uE037": "6",
    "\uE038": "7",
    "\uE039": "8",
    "\uE03A": "9",
  };

  return clean(text)
    .split("")
    .map(
      (char) =>
        salaryMap[char] ??
        char
    )
    .join("");
}

// =========================
// 联系人
// =========================

function extractContactName(detail) {
  let name = textWithin(
    detail,
    ".job-boss-info h2.name"
  );

  if (!name) {
    return "";
  }

  name = name
    .replace(/\s*在线\s*$/i, "")
    .replace(/\s*刚刚活跃\s*$/i, "")
    .replace(/\s*今日活跃\s*$/i, "")
    .replace(/\s*本周活跃\s*$/i, "")
    .replace(/\s*本月活跃\s*$/i, "")
    .replace(/\s*\d+\s*分钟前活跃\s*$/i, "")
    .replace(/\s*\d+\s*小时前活跃\s*$/i, "")
    .replace(/\s*\d+\s*天前活跃\s*$/i, "")
    .trim();

  return name;
}

// =========================
// 公司 + Recruiter Title
// =========================

function extractBossInfo(detail) {
  const text = textWithin(
    detail,
    ".boss-info-attr"
  );

  if (!text) {
    return {
      company: "",
      recruiterTitle: "",
    };
  }

  const parts = text
    .split("·")
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);

  return {
    company:
      parts[0] || "",

    recruiterTitle:
      parts
        .slice(1)
        .join(" · ") || "",
  };
}

// =========================
// Job ID
// =========================

function extractJobIdentity(detail) {
  const moreJobLink =
    detail.querySelector(
      "a.more-job-btn"
    );

  const href =
    moreJobLink?.href || "";

  if (!href) {
    return {
      jobId: "",
      jobUrl:
        window.location.href,
    };
  }

  const match = href.match(
    /\/job_detail\/([^/?]+)\.html/
  );

  return {
    jobId:
      match?.[1] || "",

    jobUrl: href,
  };
}

// =========================
// Salary
// =========================

function extractSalary(detail) {
  const salaryElement =
    detail.querySelector(
      ".job-salary"
    );

  if (!salaryElement) {
    return "";
  }

  const rawSalary = clean(
    salaryElement.innerText ||
      salaryElement.textContent ||
      ""
  );

  return decodeBossSalary(
    rawSalary
  );
}

// =========================
// Location
// =========================

function extractLocation(detail) {
  const header =
    detail.querySelector(
      ".job-header-info"
    );

  if (!header) {
    return "";
  }

  const links =
    header.querySelectorAll("a");

  for (const link of links) {
    const href =
      link.href || "";

    const text = clean(
      link.innerText ||
        link.textContent ||
        ""
    );

    if (
      text &&
      href.includes(
        "zhipin.com/c"
      )
    ) {
      return text;
    }
  }

  return "";
}

// =========================
// JD
// =========================

function extractJobDescription(
  detail
) {
  const body =
    detail.querySelector(
      ".job-detail-body"
    );

  if (!body) {
    return clean(
      detail.innerText ||
        detail.textContent ||
        ""
    ).slice(0, 12000);
  }

  return clean(
    body.innerText ||
      body.textContent ||
      ""
  ).slice(0, 12000);
}

// =========================
// 提取当前右侧职位
// =========================

function extractCurrentJob() {
  const detail =
    document.querySelector(
      ".job-detail-container"
    );

  if (!detail) {
    throw new Error(
      "未找到当前职位详情"
    );
  }

  const {
    jobId,
    jobUrl,
  } = extractJobIdentity(detail);

  const title =
    textWithin(
      detail,
      ".job-name"
    );

  const salary =
    extractSalary(detail);

  const location =
    extractLocation(detail);

  const address =
    textWithin(
      detail,
      ".job-address-desc"
    );

  const contactName =
    extractContactName(
      detail
    );

  const {
    company,
    recruiterTitle,
  } = extractBossInfo(detail);

  const jd =
    extractJobDescription(
      detail
    );

  if (!title) {
    throw new Error(
      "未识别到职位名称"
    );
  }

  if (!jobId) {
    throw new Error(
      "未识别到 Job ID"
    );
  }

  if (!jd) {
    throw new Error(
      "未识别到职位描述"
    );
  }

  return {
    jobId,
    title,
    company,
    contactName,
    recruiterTitle,
    salary,
    location,
    address,
    jd,
    url: jobUrl,
  };
}

// =========================
// 获取左侧职位卡片
// =========================

function getJobCards() {
  const container =
    document.querySelector(
      ".job-list-container"
    );

  if (!container) {
    return [];
  }

  // 当前 BOSS 搜索页职位卡
  let cards = [
    ...container.querySelectorAll(
      ".job-card-box"
    ),
  ];

  // fallback：
  // 页面 class 如果轻微变化
  if (cards.length === 0) {
    cards = [
      ...container.children,
    ].filter((el) => {
      const text = clean(
        el.innerText
      );

      return (
        text.length > 20 &&
        text.length < 500
      );
    });
  }

  return cards;
}

// =========================
// 当前 Job ID
// =========================

function getCurrentJobId() {
  const detail =
    document.querySelector(
      ".job-detail-container"
    );

  if (!detail) {
    return "";
  }

  return extractJobIdentity(
    detail
  ).jobId;
}

// =========================
// 等待职位切换
// =========================

function waitForJobChange(
  previousJobId,
  timeout = 8000
) {
  return new Promise(
    (resolve, reject) => {
      const start =
        Date.now();

      const timer =
        setInterval(() => {
          const currentJobId =
            getCurrentJobId();

          if (
            currentJobId &&
            currentJobId !==
              previousJobId
          ) {
            clearInterval(
              timer
            );

            resolve(
              currentJobId
            );

            return;
          }

          if (
            Date.now() -
              start >
            timeout
          ) {
            clearInterval(
              timer
            );

            reject(
              new Error(
                "等待职位切换超时"
              )
            );
          }
        }, 200);
    }
  );
}

// =========================
// 点击第 N 个职位
// =========================

async function selectJobCard(
  index
) {
  const cards =
    getJobCards();

  if (
    index < 0 ||
    index >= cards.length
  ) {
    throw new Error(
      `职位索引不存在：${index}`
    );
  }

  const previousJobId =
    getCurrentJobId();

  const card =
    cards[index];

  card.scrollIntoView({
    behavior: "instant",
    block: "center",
  });

  card.click();

  // 第一条可能本来已经是当前职位
  // 所以短暂等待后先检查
  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        500
      )
  );

  const currentJobId =
    getCurrentJobId();

  if (
    currentJobId &&
    currentJobId ===
      previousJobId &&
    index === 0
  ) {
    return currentJobId;
  }

  if (
    currentJobId &&
    currentJobId !==
      previousJobId
  ) {
    return currentJobId;
  }

  return await waitForJobChange(
    previousJobId
  );
}

// =========================
// Extension Messages
// =========================

chrome.runtime.onMessage.addListener(
  (
    message,
    _sender,
    sendResponse
  ) => {
    // 单职位读取
    if (
      message?.type ===
      "JOBPILOT_EXTRACT"
    ) {
      try {
        sendResponse({
          success: true,
          job:
            extractCurrentJob(),
        });
      } catch (error) {
        sendResponse({
          success: false,
          error:
            error?.message ||
            "职位读取失败",
        });
      }

      return;
    }

    // 获取职位列表数量
    if (
      message?.type ===
      "JOBPILOT_GET_JOB_COUNT"
    ) {
      const cards =
        getJobCards();

      sendResponse({
        success: true,
        count:
          cards.length,
      });

      return;
    }

    // 点击指定职位
    if (
      message?.type ===
      "JOBPILOT_SELECT_JOB"
    ) {
      selectJobCard(
        message.index
      )
        .then(() => {
          const job =
            extractCurrentJob();

          sendResponse({
            success: true,
            job,
          });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error?.message ||
              "职位切换失败",
          });
        });

      // 异步 sendResponse
      return true;
    }
  }
);