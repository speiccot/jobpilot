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
// 联系人姓名
// =========================

function extractContactName(detail) {
  let name = textWithin(
    detail,
    ".job-boss-info h2.name"
  );

  if (!name) {
    return "";
  }

  // BOSS 可能出现：
  // 朱女士 在线
  // 朱女士 刚刚活跃
  // 朱女士 今日活跃
  // 朱女士 3小时前活跃
  // 朱女士 本月活跃

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

  // 当前 BOSS 格式示例：
  //
  // 百度 · 百度hr
  // 快手 · HR-招聘

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
      parts.slice(1).join(" · ") ||
      "",
  };
}

// =========================
// Job ID + 真实 Job URL
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

  // 先尝试 HTML attribute。
  // 有些网站会在 aria-label/title 里保留正常文字。
  const ariaLabel = clean(
    salaryElement.getAttribute(
      "aria-label"
    )
  );

  if (ariaLabel) {
    return ariaLabel;
  }

  const title = clean(
    salaryElement.getAttribute(
      "title"
    )
  );

  if (title) {
    return title;
  }

  // 普通 DOM text。
  // BOSS 某些页面会通过自定义字体显示数字，
  // 此时这里仍可能得到 PUA 字符。
  return clean(
    salaryElement.innerText ||
    salaryElement.textContent ||
    ""
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

  // 当前 DOM 中第一个城市链接：
  // https://www.zhipin.com/c101010100/
  const links =
    header.querySelectorAll("a");

  for (const link of links) {
    const href =
      link.href || "";

    const text =
      clean(link.innerText);

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

function extractJobDescription(detail) {
  const body =
    detail.querySelector(
      ".job-detail-body"
    );

  if (!body) {
    return clean(
      detail.innerText
    ).slice(0, 12000);
  }

  return clean(
    body.innerText ||
    body.textContent ||
    ""
  ).slice(0, 12000);
}

// =========================
// 当前职位
// =========================

function extractCurrentJob() {
  // 最重要：
  // 永远只读取右侧当前职位，
  // 不扫描左侧职位列表。

  const detail =
    document.querySelector(
      ".job-detail-container"
    );

  if (!detail) {
    throw new Error(
      "未找到当前职位详情，请先在 BOSS 中点开一个职位"
    );
  }

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
  } =
    extractBossInfo(detail);

  const {
    jobId,
    jobUrl,
  } =
    extractJobIdentity(
      detail
    );

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
      "未识别到 BOSS Job ID"
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
// Chrome Extension Message
// =========================

chrome.runtime.onMessage.addListener(
  (
    message,
    _sender,
    sendResponse
  ) => {
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
    }
  }
);