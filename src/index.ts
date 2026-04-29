import { streamText, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createMockModel } from "./mock-model";
import dotenv from 'dotenv';
import { createInterface } from 'node:readline';

dotenv.config();

const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.DASHSCOPE_API_KEY;

const deepseek = createOpenAI({
  apiKey,
  // OpenAI 兼容接口应为 /v1/chat/completions，勿使用 /anthropic
  baseURL: 'https://api.deepseek.com/v1',
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
      messages,
    });

    process.stdout.write('Assistant: ');
    let fullResponse = '';
    for await (const chunk of result.textStream) { 
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    console.log(); // 换行
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


