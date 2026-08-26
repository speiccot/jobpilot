# JobPilot MVP

JobPilot 是一个 human-in-the-loop AI 求职 Copilot。

## 第一版能力

1. 打开 BOSS 职位详情页
2. Chrome Extension 读取当前页面岗位信息
3. 调用本地 Next.js API
4. AI 输出：
   - 岗位匹配分 0-100
   - apply / maybe / skip
   - 岗位类型
   - 推荐原因
   - 风险点
   - 针对性开场白
5. 用户人工确认后决定是否发送

第一版不做：
- 无人值守批量投递
- CAPTCHA 绕过
- 反爬 / 风控规避
- 自动登录
- 自动批量私信

## 运行

```bash
cp .env.example .env.local
```

把 OpenAI API Key 写入 `.env.local`：

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
```

然后：

```bash
npm install
npm run dev
```

默认后端：

```text
http://localhost:3000
```

## 安装 Chrome Extension

1. 打开 `chrome://extensions`
2. 打开 Developer mode
3. 点击 Load unpacked
4. 选择 `jobpilot/extension`
5. 打开一个 BOSS 职位详情页
6. 点击 JobPilot 图标
7. 点击 `Analyze current job`

## Architecture

```text
BOSS 当前职位页
        ↓
Chrome Content Script
        ↓
Job Parser
        ↓
POST /api/analyze
        ↓
LLM Job Matcher
        ↓
Score / Recommendation / Risks
        ↓
Personalized Opening Message
        ↓
Human Confirmation
```

## 下一阶段

- 多份 Resume Persona
  - AI PM
  - Data Scientist
  - AI Engineer
- SQLite / Postgres 投递数据库
- 自动去重
- 投递状态跟踪
- Resume Selector
- Dashboard
- Apply → Reply → Interview 转化漏斗
- 基于用户明确确认的页面操作
