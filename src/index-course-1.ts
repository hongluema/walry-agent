import { streamText, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createMockModel } from "./mock-model";
import dotenv from 'dotenv';
import { createInterface } from 'node:readline';
import { weatherTool, calculatorTool } from './tool';

dotenv.config();

const tools = { get_weather: weatherTool, calculator: calculatorTool };

const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.DASHSCOPE_API_KEY;

const deepseek = createOpenAI({
  apiKey,
  // OpenAI 兼容接口应为 /v1/chat/completions，勿使用 /anthropic
  baseURL: 'https://api.deepseek.com/v1',
  fetch: async (input, init) => {
    if (typeof input === 'string' && input.endsWith('/chat/completions') && typeof init?.body === 'string') {
      const body = JSON.parse(init.body);

      // DeepSeek thinking 模式要求续传 reasoning_content，
      // 当前 @ai-sdk/openai chat 适配层不会回传该字段，因此显式关闭。
      body.thinking = { type: 'disabled' };
      delete body.reasoning_effort;

      return fetch(input, {
        ...init,
        body: JSON.stringify(body),
      });
    }

    return fetch(input, init);
  },
});

const modelName = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro';
const model = apiKey ? deepseek.chat(modelName) : createMockModel();

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

function ask() {
  rl.question('\nYou: ', async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'exit') {
      console.log('Bye!');
      rl.close();
      return;
    }

    messages.push({ role: 'user', content: trimmed });

    const result = streamText({
      model,
      system: `你是 Walry Agent，一个专注于解决用户困扰的逻辑学专家。
      你说话简洁直接，用户的问题可能很复杂，请用简单的例子和类比来解释，帮助他们理解。
      如果用户的问题不够清晰，你会反问而不是瞎猜，使用中文回答。
      `,
      messages,
    });

    process.stdout.write('Assistant: ');
    for await (const chunk of result.textStream) { 
      process.stdout.write(chunk);
    }
    console.log(); // 换行
    // 必须回写完整的模型消息，不能只保存文本，否则会丢失推理内容。
    const response = await result.response;
    messages.push(...response.messages);
    ask();
  })
}
async function main() {
  // const { text } = await generateText({
  //   model,
  //   prompt: '用一句话介绍你自己',
  // })

  // console.log(text);

  // ==============================
  const result = streamText({
    model,
    prompt: '用一句话介绍你自己',
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log(); // 换行
}
// main();

console.log('Super Agent v0.1 (type "exit" to quit)\n');
ask();
