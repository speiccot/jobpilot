function clean(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function textWithin(root, selector) {
  if (!root) {
    return "";
  }

  const el =
    root.querySelector(selector);

  return clean(
    el?.innerText ||
      el?.textContent ||
      ""
  );
}

// =========================
// BOSS 薪资字体解码
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

  // 例如：
  // 朱女士 在线
  // 朱女士 刚刚活跃
  // 朱女士 今日活跃
  // 朱女士 3小时前活跃

  name = name
    .replace(/\s*在线\s*$/i, "")
    .replace(
      /\s*刚刚活跃\s*$/i,
      ""
    )
    .replace(
      /\s*今日活跃\s*$/i,
      ""
    )
    .replace(
      /\s*本周活跃\s*$/i,
      ""
    )
    .replace(
      /\s*本月活跃\s*$/i,
      ""
    )
    .replace(
      /\s*\d+\s*分钟前活跃\s*$/i,
      ""
    )
    .replace(
      /\s*\d+\s*小时前活跃\s*$/i,
      ""
    )
    .replace(
      /\s*\d+\s*天前活跃\s*$/i,
      ""
    )
    .trim();

  return name;
}

// =========================
// 公司 + 招聘者职位
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

  // 示例：
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
      parts
        .slice(1)
        .join(" · ") ||
      "",
  };
}

// =========================
// Job ID + 真实 Job URL
// =========================

function extractJobIdentity(
  detail
) {
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

  const match =
    href.match(
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

  // 先检查有没有正常文字属性
  const ariaLabel = clean(
    salaryElement.getAttribute(
      "aria-label"
    )
  );

  if (ariaLabel) {
    return decodeBossSalary(
      ariaLabel
    );
  }

  const title = clean(
    salaryElement.getAttribute(
      "title"
    )
  );

  if (title) {
    return decodeBossSalary(
      title
    );
  }

  // DOM 中的自定义字体字符
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
// 城市
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

    const text =
      clean(
        link.innerText ||
          link.textContent ||
          ""
      );

    // 当前 BOSS 城市链接类似：
    // /c101010100/
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
// 工作地址
// =========================

function extractAddress(detail) {
  return textWithin(
    detail,
    ".job-address-desc"
  );
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
// 当前职位提取
// =========================

function extractCurrentJob() {
  // 最关键：
  // 只读取右侧当前打开的职位详情，
  // 不碰左侧职位列表。

  const detail =
    document.querySelector(
      ".job-detail-container"
    );

  if (!detail) {
    throw new Error(
      "未找到当前职位详情，请先在 BOSS 中点开一个职位"
    );
  }

  // 1. Job Identity
  const {
    jobId,
    jobUrl,
  } =
    extractJobIdentity(
      detail
    );

  // 2. 基础字段
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
    extractAddress(detail);

  const contactName =
    extractContactName(
      detail
    );

  const {
    company,
    recruiterTitle,
  } =
    extractBossInfo(
      detail
    );

  const jd =
    extractJobDescription(
      detail
    );

  // 3. 必要字段检查
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

  // 4. 返回标准 Job Object
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

    url:
      jobUrl,
  };
}

// =========================
// Chrome Extension 消息监听
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
        const job =
          extractCurrentJob();

        sendResponse({
          success: true,
          job,
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