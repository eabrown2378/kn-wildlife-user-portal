const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
require('dotenv').config();

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 主路由处理：POST /chatbot
router.post('/', async (req, res) => {
  const { message, graphResult } = req.body;

  // message 是必须的
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ response: 'Missing or invalid message text.' });
  }

  // 简化 graphResult 的展示（如果有）
  const graphSummary = graphResult
    ? JSON.stringify(graphResult, null, 2).slice(0, 2000)
    : '(no graph data provided)';

  // 构建提示词
  const prompt = `
You are an expert in biodiversity and ecological graph data.

Here is a graph-based dataset from Neo4j (summarized below):

${graphSummary}

Now answer the user's question: "${message}"

Provide a clear, informative, and concise response.
`;

  try {
    // 调用 OpenAI Chat Completion
    const chat = await openai.chat.completions.create({
      model: "gpt-4o", // ← 改成 "gpt-3.5-turbo" 可测试免费版
      messages: [
        { role: "system", content: "You are a helpful assistant specialized in biological graph data." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    const reply = chat.choices[0].message.content;
    return res.json({ response: reply });

  } catch (err) {
    console.error("❌ OpenAI call failed:", err);

    // 如果是权限或 model 错误，尝试 fallback 到 gpt-3.5-turbo
    if (err.code === 'invalid_api_key' || err.response?.status === 401) {
      return res.status(401).json({ response: 'Invalid or missing OpenAI API key.' });
    }

    return res.status(500).json({ response: "Failed to contact OpenAI." });
  }
});

// 可选 GET 用于测试 endpoint 是否在线
router.get('/', (req, res) => {
  res.send('✅ Chatbot endpoint is active. Use POST to interact.');
});

module.exports = router;
