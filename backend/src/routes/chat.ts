import express from 'express';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

const router = express.Router();

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ChatHistory {
  userId: string;
  messages: ChatMessage[];
}

const chatSessions = new Map<string, ChatHistory>();

router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.userId as string;
    const session = chatSessions.get(userId);
    res.json({ messages: session?.messages || [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/send', async (req, res) => {
  const { message } = req.body;
  const userId = req.user?.userId as string;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let session = chatSessions.get(userId);
    if (!session) {
      session = { userId, messages: [] };
      chatSessions.set(userId, session);
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(userMessage);

    const response = await generateResponse(message, userId, session.messages);

    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: response,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(assistantMessage);

    res.json({ messages: session.messages });
  } catch (err) {
    logger.error('Chat error:', err as Error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

router.post('/clear', async (req, res) => {
  try {
    const userId = req.user?.userId as string;
    chatSessions.delete(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

async function generateResponse(message: string, userId: string, history: ChatMessage[]): Promise<string> {
  const aiApiKey = process.env.AI_API_KEY;
  const aiApiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';

  if (aiApiKey) {
    try {
      const systemPrompt = `你是一个智能家居助手，帮助用户管理和控制智能设备。
用户可能会问：
1. 控制设备："打开客厅灯"、"关闭空调"、"把温度调到26度"
2. 查询状态："空调现在开着吗？"、"温度是多少？"
3. 场景操作："执行回家场景"、"开启睡眠模式"
4. 能耗查询："今天用了多少电？"、"哪个设备耗电最多？"
5. 定时设置："明天早上7点打开热水器"

请用友好、简洁的语言回答。如果是控制指令，请确认操作。不要暴露技术细节。`;

      const response = await fetch(aiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json() as { choices?: { message?: { content?: string } }[] };
        return data.choices?.[0]?.message?.content || '抱歉，我没理解您的意思。';
      } else {
        logger.warn(`AI API response error: ${response.status}`);
      }
    } catch (error) {
      logger.error('AI API call failed:', error as Error);
    }
  }

  return getFallbackResponse(message);
}

function getFallbackResponse(message: string): string {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('开灯') || lowerMsg.includes('打开') || lowerMsg.includes('开启')) {
    return '好的，我来帮您打开设备。请问您想打开哪个设备？';
  }
  if (lowerMsg.includes('关灯') || lowerMsg.includes('关闭') || lowerMsg.includes('关掉')) {
    return '好的，我来帮您关闭设备。请问您想关闭哪个设备？';
  }
  if (lowerMsg.includes('温度') || lowerMsg.includes('空调')) {
    return '好的，我来帮您调节温度。请问您想设置多少度？';
  }
  if (lowerMsg.includes('能耗') || lowerMsg.includes('用电') || lowerMsg.includes('电费')) {
    return '您可以在能耗页面查看详细的能耗统计和账单信息。';
  }
  if (lowerMsg.includes('定时') || lowerMsg.includes('预约')) {
    return '您可以在设备卡片中点击"定时"按钮设置定时任务。';
  }
  if (lowerMsg.includes('场景') || lowerMsg.includes('模式')) {
    return '您可以在场景页面创建和执行自定义场景。';
  }
  if (lowerMsg.includes('你好') || lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
    return '您好！我是您的智能家居助手，有什么可以帮您的吗？';
  }
  
  return '抱歉，我还在学习中。您可以尝试说："打开客厅灯"、"调节空调温度"、"查看能耗"等。';
}

export const chatRoutes = router;