function clean(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );
}

function textWithin(
  root,
  selector
) {
  if (!root) {
    return "";
  }

  const el =
    root.querySelector(
      selector
    );

  return clean(
    el?.innerText ||
      el?.textContent ||
      ""
  );
}

// =========================
// BOSS 薪资解码
// =========================

function decodeBossSalary(
  text
) {
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

function extractContactName(
  detail
) {
  let name = textWithin(
    detail,
    ".job-boss-info h2.name"
  );

  if (!name) {
    return "";
  }

  name = name
    .replace(
      /\s*在线\s*$/i,
      ""
    )
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
// 公司 + Recruiter Title
// =========================

function extractBossInfo(
  detail
) {
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
        .join(" · ") ||
      "",
  };
}

// =========================
// Job ID + 真实 URL
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

    jobUrl:
      href,
  };
}

// =========================
// Salary
// =========================

function extractSalary(
  detail
) {
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

function extractLocation(
  detail
) {
  const header =
    detail.querySelector(
      ".job-header-info"
    );

  if (!header) {
    return "";
  }

  const links =
    header.querySelectorAll(
      "a"
    );

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
// 当前右侧职位
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
  } =
    extractJobIdentity(
      detail
    );

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
    extractBossInfo(
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
// 左侧职位容器
// =========================

function getJobListContainer() {
  return (
    document.querySelector(
      ".job-list-container"
    ) ||
    document.querySelector(
      ".recommend-result-inner"
    )
  );
}

// =========================
// 当前 DOM 的 Job Cards
// =========================

function getJobCards() {
  const container =
    getJobListContainer();

  if (!container) {
    return [];
  }

  let cards = [
    ...container.querySelectorAll(
      ".job-card-box"
    ),
  ];

  if (
    cards.length === 0
  ) {
    cards = [
      ...container.querySelectorAll(
        "li"
      ),
    ].filter(
      (el) => {
        const text =
          clean(
            el.innerText
          );

        return (
          text.length > 20 &&
          text.length < 600
        );
      }
    );
  }

  return cards;
}

// =========================
// 从 Job Card 尝试获得稳定 Key
// 不依赖列表 index
// =========================

function getCardKey(card) {
  if (!card) {
    return "";
  }

  // 优先读取 Job URL
  const links =
    card.querySelectorAll(
      "a"
    );

  for (const link of links) {
    const href =
      link.href || "";

    const match =
      href.match(
        /\/job_detail\/([^/?]+)\.html/
      );

    if (match?.[1]) {
      return (
        "job:" +
        match[1]
      );
    }
  }

  // 尝试 data 属性
  const possibleId =
    card.dataset?.jobid ||
    card.dataset?.jobId ||
    card.getAttribute(
      "data-jobid"
    ) ||
    card.getAttribute(
      "data-job-id"
    );

  if (possibleId) {
    return (
      "job:" +
      possibleId
    );
  }

  // 最后 fallback：
  // 用卡片文字做 signature
  return (
    "text:" +
    clean(
      card.innerText
    ).slice(0, 300)
  );
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
// 等待右侧 Job 切换
// =========================

function waitForJobChange(
  previousJobId,
  timeout = 10000
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
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
                "等待职位详情切换超时"
              )
            );
          }
        }, 200);
    }
  );
}

// =========================
// 等待右侧详情稳定
// =========================

async function waitForDetailStable(
  expectedJobId
) {
  const start =
    Date.now();

  while (
    Date.now() -
      start <
    5000
  ) {
    const currentJobId =
      getCurrentJobId();

    if (
      currentJobId ===
      expectedJobId
    ) {
      await sleep(300);

      if (
        getCurrentJobId() ===
        expectedJobId
      ) {
        return;
      }
    }

    await sleep(150);
  }

  throw new Error(
    "职位详情未稳定加载"
  );
}

// =========================
// 点击一个具体 Card
// =========================

async function selectCard(
  card
) {
  if (!card) {
    throw new Error(
      "职位卡不存在"
    );
  }

  const previousJobId =
    getCurrentJobId();

  card.scrollIntoView({
    behavior: "auto",
    block: "center",
  });

  await sleep(150);

  // 尽量点 card 内真正可点击区域
  const clickTarget =
    card.querySelector(
      "a.job-card-left"
    ) ||
    card.querySelector(
      ".job-card-body"
    ) ||
    card.querySelector(
      ".job-name"
    ) ||
    card.querySelector(
      "a"
    ) ||
    card;

  clickTarget.click();

  await sleep(350);

  let currentJobId =
    getCurrentJobId();

  // 如果本身就是当前职位
  if (
    currentJobId &&
    currentJobId ===
      previousJobId
  ) {
    // 再检查当前 card 是否其实对应当前 job
    const cardKey =
      getCardKey(card);

    if (
      cardKey ===
      `job:${currentJobId}`
    ) {
      await waitForDetailStable(
        currentJobId
      );

      return currentJobId;
    }
  }

  if (
    !currentJobId ||
    currentJobId ===
      previousJobId
  ) {
    currentJobId =
      await waitForJobChange(
        previousJobId
      );
  }

  await waitForDetailStable(
    currentJobId
  );

  return currentJobId;
}

// =========================
// 滚动加载更多职位
// =========================

async function loadMoreJobs(
  previousCardCount
) {
  const container =
    getJobListContainer();

  const cards =
    getJobCards();

  const lastCard =
    cards[
      cards.length - 1
    ];

  // 先滚到当前最后一个职位
  if (lastCard) {
    lastCard.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  }

  // 如果左侧本身是可滚动容器
  if (container) {
    try {
      container.scrollTop =
        container.scrollHeight;
    } catch {
      // ignore
    }
  }

  // 同时滚动页面，兼容 BOSS
  // 将职位列表放在 document scroll 中
  window.scrollTo({
    top:
      document.documentElement
        .scrollHeight,
    behavior: "auto",
  });

  // 等 lazy load
  const start =
    Date.now();

  while (
    Date.now() -
      start <
    5000
  ) {
    await sleep(400);

    const newCount =
      getJobCards().length;

    if (
      newCount >
      previousCardCount
    ) {
      return {
        loaded: true,
        count:
          newCount,
      };
    }
  }

  return {
    loaded: false,
    count:
      getJobCards()
        .length,
  };
}

// =========================
// Infinite Scan Manager
// =========================

async function collectJobs(
  targetCount,
  onProgress
) {
  const jobs = [];

  const seenJobIds =
    new Set();

  const attemptedCardKeys =
    new Set();

  let noGrowthRounds = 0;

  const MAX_NO_GROWTH_ROUNDS =
    4;

  while (
    jobs.length <
    targetCount
  ) {
    const cards =
      getJobCards();

    if (
      cards.length === 0
    ) {
      throw new Error(
        "当前页面没有找到职位卡片"
      );
    }

    let processedNewCard =
      false;

    // 每轮重新获取 DOM cards
    // 防止 lazy load 后 Node 变化
    for (
      let index = 0;
      index <
      cards.length;
      index++
    ) {
      if (
        jobs.length >=
        targetCount
      ) {
        break;
      }

      const currentCards =
        getJobCards();

      const card =
        currentCards[index];

      if (!card) {
        continue;
      }

      const cardKey =
        getCardKey(card);

      if (
        attemptedCardKeys.has(
          cardKey
        )
      ) {
        continue;
      }

      attemptedCardKeys.add(
        cardKey
      );

      processedNewCard =
        true;

      if (onProgress) {
        onProgress({
          phase:
            "extracting",

          collected:
            jobs.length,

          target:
            targetCount,

          visibleCards:
            currentCards.length,
        });
      }

      try {
        await selectCard(
          card
        );

        const job =
          extractCurrentJob();

        if (
          !job?.jobId
        ) {
          continue;
        }

        if (
          seenJobIds.has(
            job.jobId
          )
        ) {
          continue;
        }

        seenJobIds.add(
          job.jobId
        );

        jobs.push(job);

        if (onProgress) {
          onProgress({
            phase:
              "collected",

            collected:
              jobs.length,

            target:
              targetCount,

            visibleCards:
              currentCards.length,

            title:
              job.title,

            company:
              job.company,
          });
        }

        // 给 BOSS 页面一点缓冲
        await sleep(200);

      } catch (error) {
        console.warn(
          "JobPilot 跳过一个无法读取的职位：",
          error
        );
      }
    }

    if (
      jobs.length >=
      targetCount
    ) {
      break;
    }

    // 当前已有 cards 都处理过了
    // 尝试加载更多
    const beforeCount =
      getJobCards().length;

    if (onProgress) {
      onProgress({
        phase:
          "loading_more",

        collected:
          jobs.length,

        target:
          targetCount,

        visibleCards:
          beforeCount,
      });
    }

    const loadResult =
      await loadMoreJobs(
        beforeCount
      );

    if (
      loadResult.loaded
    ) {
      noGrowthRounds = 0;

      // 加载新职位后
      // 稍微回到列表区域
      await sleep(500);

      continue;
    }

    noGrowthRounds++;

    // 某些情况下数量没有增加，
    // 但 DOM 内容被虚拟列表替换了；
    // 所以即使 count 不变，也再跑几轮，
    // attemptedCardKeys 会判断是否出现新卡。
    const afterCards =
      getJobCards();

    const hasUnseenCard =
      afterCards.some(
        (card) =>
          !attemptedCardKeys.has(
            getCardKey(card)
          )
      );

    if (hasUnseenCard) {
      noGrowthRounds = 0;
      continue;
    }

    if (
      !processedNewCard &&
      noGrowthRounds >=
        MAX_NO_GROWTH_ROUNDS
    ) {
      break;
    }

    if (
      noGrowthRounds >=
      MAX_NO_GROWTH_ROUNDS
    ) {
      break;
    }
  }

  return {
    jobs,

    requested:
      targetCount,

    reachedTarget:
      jobs.length >=
      targetCount,

    collected:
      jobs.length,
  };
}

// =========================
// Chrome Messages
// =========================

chrome.runtime.onMessage.addListener(
  (
    message,
    _sender,
    sendResponse
  ) => {
    // ---------------------
    // 单职位
    // ---------------------

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

    // ---------------------
    // 当前职位数量
    // ---------------------

    if (
      message?.type ===
      "JOBPILOT_GET_JOB_COUNT"
    ) {
      sendResponse({
        success: true,

        count:
          getJobCards()
            .length,
      });

      return;
    }

    // ---------------------
    // Infinite Scan
    // ---------------------

    if (
      message?.type ===
      "JOBPILOT_COLLECT_JOBS"
    ) {
      const targetCount =
        Math.max(
          1,
          Math.min(
            Number(
              message.targetCount
            ) || 10,
            300
          )
        );

      collectJobs(
        targetCount
      )
        .then(
          (result) => {
            sendResponse({
              success: true,
              ...result,
            });
          }
        )
        .catch(
          (error) => {
            sendResponse({
              success: false,

              error:
                error?.message ||
                "批量提取职位失败",
            });
          }
        );

      return true;
    }
  }
);