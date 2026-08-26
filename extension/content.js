function clean(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function firstText(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = clean(el?.innerText || el?.textContent || "");
    if (text) return text;
  }
  return "";
}

function extractJob() {
  const title = firstText(["h1", ".job-name", ".name"]);
  const company = firstText([
    ".company-info .name",
    ".company-name",
    ".sider-company .company-info a",
  ]);
  const salary = firstText([".salary", ".job-primary .salary"]);
  const jobLocation = firstText([
    ".job-location",
    ".job-address",
    ".text-city",
  ]);
  const jd = firstText([
    ".job-sec-text",
    ".job-detail-section .text",
    ".job-detail",
  ]);

  const fallback = clean(
    document.querySelector("main")?.innerText ||
      document.body.innerText ||
      ""
  );

  return {
    title,
    company,
    salary,
    location: jobLocation,
    jd: jd || fallback.slice(0, 12000),
    url: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "JOBPILOT_EXTRACT") {
    sendResponse(extractJob());
  }
});
