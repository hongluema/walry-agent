import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createMockModel } from "./mock-model";
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.DASHSCOPE_API_KEY;

const deepseek = createOpenAI({
  apiKey,
  // OpenAI 兼容接口应为 /v1/chat/completions，勿使用 /anthropic
  baseURL: 'https://api.deepseek.com/v1',
});

const modelName = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro';
const model = apiKey ? deepseek.chat(modelName) : createMockModel();

async function main() {
  const { text } = await generateText({
    model,
    prompt: '用一句话介绍你自己',
  })

  console.log(text);
}

main();
