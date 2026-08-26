const $ = (id) => document.getElementById(id);

function fillSimpleList(id, items) {
  const el = $(id);

  el.innerHTML = "";

  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "暂无";
    el.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  }
}

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

$("uploadResume").addEventListener("click", async () => {
  const fileInput = $("resumeFile");
  const status = $("resumeStatus");

  const file = fileInput.files[0];

  if (!file) {
    status.textContent = "请先选择一份简历";
    return;
  }

  status.textContent = "正在上传简历...";

  try {
    const formData = new FormData();

    formData.append("resume", file);

    const response = await fetch(
      "http://localhost:3001/api/resume",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "简历上传失败");
    }

    status.textContent =
  `✓ ${data.file.name} 分析完成，已生成候选人画像`;

  const profile = data.profile;

$("profileName").textContent =
  profile.name || "未识别";

$("profileSummary").textContent =
  profile.summary || "暂无";

$("profileSkills").textContent =
  (profile.skills || []).join(" · ") || "暂无";

fillSimpleList(
  "profileExperience",
  (profile.experience || []).map((item) => {
    const descriptions =
      (item.description || []).join("；");

    return `${item.title || ""} @ ${item.company || ""}${
      descriptions ? `：${descriptions}` : ""
    }`;
  })
);

fillSimpleList(
  "profileEducation",
  (profile.education || []).map((item) => {
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
  (profile.projects || []).map((item) => {
    const descriptions =
      (item.description || []).join("；");

    return `${item.name || ""}${
      descriptions ? `：${descriptions}` : ""
    }`;
  })
);

$("profilePreview").style.display = "block";

  } catch (error) {
    status.textContent =
      `上传失败：${error.message}`;
  }
  
});