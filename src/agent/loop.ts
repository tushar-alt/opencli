import type { ResolvedConfig } from '../config/types.js';
import type { Message, ToolCall, AssistantMessage, ToolMessage } from '../providers/types.js';
import { createAdapter } from '../providers/factory.js';
import { getEnabledDefinitions, dispatchTool } from '../tools/registry.js';
import { StreamingRenderer, printToolCall, printToolResult } from '../ui/renderer.js';
import { theme } from '../ui/theme.js';
import ora from 'ora';
import chalk from 'chalk';

export interface RunResult {
  text: string;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Run the agentic loop: send messages → stream → handle tool calls → repeat.
 * Streams output directly to stdout as it arrives.
 */
export async function runAgentLoop(
  messages: Message[],
  config: ResolvedConfig,
  cwd: string,
): Promise<RunResult> {
  const adapter = createAdapter(config);
  const tools = getEnabledDefinitions(config);

  let allMessages = [...messages];
  let totalToolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalText = '';

  for (let turn = 0; turn < config.maxTurns; turn++) {
    const renderer = new StreamingRenderer(config.thinkMode);
    const pendingToolCalls: ToolCall[] = [];
    let assistantText = '';
    let stopReason = 'end_turn';
    let hasReceivedData = false;

    // Start loading spinner
    const spinner = ora({
      text: chalk.cyan('Thinking'),
      spinner: 'dots',
      color: 'cyan',
    }).start();

    // Stream from the AI
    const stream = adapter.stream(allMessages, tools, config.thinkMode, config.thinkBudget);

    for await (const event of stream) {
      // Stop spinner on first data received
      if (!hasReceivedData) {
        hasReceivedData = true;
        spinner.stop();
      }

      switch (event.type) {
        case 'text_delta':
          assistantText += event.delta;
          renderer.pushText(event.delta);
          break;

        case 'thinking_delta':
          renderer.pushThinking(event.delta);
          break;

        case 'tool_call_ready':
          pendingToolCalls.push(event.call);
          break;

        case 'usage':
          totalInputTokens += event.input;
          totalOutputTokens += event.output;
          break;

        case 'stop':
          stopReason = event.reason;
          break;
      }
    }

    renderer.end();
    finalText = assistantText;

    // Build assistant message for history
    const assistantMsg: AssistantMessage = {
      role: 'assistant',
      content: assistantText,
      ...(pendingToolCalls.length > 0 ? { toolCalls: pendingToolCalls } : {}),
    };
    allMessages = [...allMessages, assistantMsg];

    // If no tool calls, we're done
    if (pendingToolCalls.length === 0 || stopReason !== 'tool_use') {
      break;
    }

    // Execute tool calls
    totalToolCalls += pendingToolCalls.length;
    process.stdout.write('\n');

    const toolMessages = await executeToolCalls(pendingToolCalls, config, cwd);
    allMessages = [...allMessages, ...toolMessages];

    // Add a newline before next assistant turn
    process.stdout.write('\n');
  }

  // Print usage stats if we have them
  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    process.stderr.write(
      theme.muted(
        `\n[tokens: ${totalInputTokens} in / ${totalOutputTokens} out` +
          (totalToolCalls > 0 ? ` | ${totalToolCalls} tool calls` : '') +
          ']\n',
      ),
    );
  }

  return {
    text: finalText,
    toolCallCount: totalToolCalls,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}

async function executeToolCalls(
  calls: ToolCall[],
  config: ResolvedConfig,
  cwd: string,
): Promise<ToolMessage[]> {
  // Classify: read-only tools can run in parallel, write/shell must be serial
  const readOnlyTools = new Set(['read_file', 'search_files', 'search_content']);

  const parallelCalls = calls.filter((c) => readOnlyTools.has(c.name));
  const serialCalls = calls.filter((c) => !readOnlyTools.has(c.name));

  const results: Array<{ call: ToolCall; result: string }> = [];

  // Run read-only calls in parallel
  if (parallelCalls.length > 0) {
    const parallelResults = await Promise.all(
      parallelCalls.map(async (call) => {
        printToolCall(call.name, call.arguments);
        const result = await dispatchTool(call.name, call.arguments, config, cwd);
        printToolResult(call.name, result);
        return { call, result };
      }),
    );
    results.push(...parallelResults);
  }

  // Run write/shell calls serially (maintain order)
  for (const call of serialCalls) {
    printToolCall(call.name, call.arguments);
    const result = await dispatchTool(call.name, call.arguments, config, cwd);
    printToolResult(call.name, result);
    results.push({ call, result });
  }

  // Sort back to original order for context coherence
  const originalOrder = calls.map((c) => c.id);
  results.sort((a, b) => originalOrder.indexOf(a.call.id) - originalOrder.indexOf(b.call.id));

  return results.map(({ call, result }): ToolMessage => ({
    role: 'tool',
    toolCallId: call.id,
    toolName: call.name,
    content: result,
  }));
}
