const $ = (id) => document.getElementById(id);

function fillList(id, items) {
  const el = $(id);
  el.innerHTML = "";

  for (const item of items || []) {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  }

  if (!items?.length) {
    const li = document.createElement("li");
    li.textContent = "暂无";
    el.appendChild(li);
  }
}

$("analyze").addEventListener("click", async () => {
  $("status").textContent = "正在读取当前职位并分析…";
  $("result").style.display = "none";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) throw new Error("无法读取当前标签页");

    const job = await chrome.tabs.sendMessage(tab.id, {
      type: "JOBPILOT_EXTRACT",
    });

    const res = await fetch("http://localhost:3001/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Analyze failed");
    }

    $("score").textContent = data.score;
    $("rec").textContent = data.recommendation;
    $("role").textContent = data.roleType;

    fillList("reasons", data.reasons);
    fillList("risks", data.risks);

    $("message").textContent = data.openingMessage;
    $("result").style.display = "block";
    $("status").textContent = "完成。由你决定是否投递。";
  } catch (error) {
    $("status").textContent = `失败：${error.message}`;
  }
});

$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("message").textContent);
  $("copy").textContent = "Copied";
});
