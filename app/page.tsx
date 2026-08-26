export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: "64px auto", padding: 24 }}>
      <h1 style={{ fontSize: 42, marginBottom: 8 }}>JobPilot</h1>
      <p style={{ fontSize: 18, color: "#555" }}>
        AI 求职 Copilot：读取当前职位、判断匹配度、识别风险、生成针对性开场白。
      </p>

      <div
        style={{
          marginTop: 32,
          padding: 24,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 20px rgba(0,0,0,.06)",
        }}
      >
        <h2>MVP Workflow</h2>
        <p>
          BOSS 职位详情页 → Chrome Extension → Job Parser → LLM Matcher →
          Score / Recommendation / Risks / Opening Message → 用户确认。
        </p>
      </div>
    </main>
  );
}
