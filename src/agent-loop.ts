import { streamText, type ModelMessage } from 'ai';

const MAX_STEPS = 10;

export async function agentLoop(
  model: any,
  tools: any,
  messages: ModelMessage[],
  system: string,
) {
  let step = 0;
  while (step < MAX_STEPS) {
    step++;
    console.log(`\n-- Step ${step} --`);

    const result = streamText({
      model,
      system,
      tools,
      messages,
      // 不设 stopWhen，循环内自行控制，每次只跑一步
    });

    let hasToolCall = false;
    let fullText = '';

    for await (const part of result.fullStream) {
      switch (part.type) { 
        case 'text-delta':
          process.stdout.write(part.text);
          fullText += part.text;
          break;
        case 'tool-call':
          hasToolCall = true;
          console.log(`\n [调用工具： ${part.toolName} ${JSON.stringify(part.input)}]`);
          break;
        case 'tool-result':
          console.log(` [结果： ${JSON.stringify(part.output)}]`);
          break;
      }
    };
    // 拿到这一步的完整结果，追加到消息历史
    const stepMessages = await result.response;
    // console.log('>>>>>>>stepMessages', JSON.stringify(stepMessages));
    messages.push(...stepMessages.messages);

    // 退出条件：模型没有调用工具，说明它认为可以直接回复了
    if (!hasToolCall) {
      if (fullText) {
        console.log();
        break;
      }
    }

    // 还有工具调用 -> 继续循环，让模型看到工具结果后继续思考
    console.log();
  }

  if (step >= MAX_STEPS) {
    console.log('\n-- 达到最大步数，退出循环 --');
  }

}