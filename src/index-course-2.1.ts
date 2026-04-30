import { streamText, stepCountIs, type ModelMessage } from "ai";
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

      // DeepSeek thinking + tools 需要后续请求回传 reasoning_content。
      // 当前 @ai-sdk/openai chat 适配层不会序列化该字段，因此显式关闭 thinking。
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

const modelName = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash';
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

    let fullResponse = '';
    const result = streamText({
      model,
      system: `你是 Walry Agent，一个有工具调用能力的 AI 助手。需要时主动使用工具获取信息，不要编造数据。
      `,
      tools,
      messages,
      stopWhen: stepCountIs(5),
    });

    process.stdout.write('Assistant: ');
    for await (const part of result.fullStream) { 
      // console.log('>>>>>part', part);
      switch (part.type) {
        case 'text-delta':
          process.stdout.write(part.text);
          fullResponse += part.text;
          break;
        case 'tool-call':
          console.log(`\n [调用工具： ${part.toolName} ${JSON.stringify(part.input)}`)
          break;
        case 'tool-result':
          console.log(` [工具返回： ${JSON.stringify(part.output)}]`);
          break;
      }
    }
    console.log(); // 换行
    // // 必须回写完整的模型消息，不能只保存文本，否则会丢失推理内容和工具消息。
    // const response = await result.response;
    // messages.push(...response.messages);
    messages.push({ role: 'assistant', content: fullResponse });
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
