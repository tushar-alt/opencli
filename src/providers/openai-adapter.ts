import OpenAI from 'openai';
import type {
  ProviderAdapter,
  StreamEvent,
  Message,
  ToolDefinition,
  ToolCall,
  StopReason,
} from './types.js';
import type { ResolvedConfig } from '../config/types.js';

interface ToolBuffer {
  id: string;
  name: string;
  argBuffer: string;
}

export class OpenAIAdapter implements ProviderAdapter {
  private client: OpenAI;
  private config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey ?? 'no-key',
      baseURL: config.endpoint,
    });
  }

  async *stream(
    messages: Message[],
    tools: ToolDefinition[],
    thinkMode: boolean,
    thinkBudget: number,
  ): AsyncGenerator<StreamEvent> {
    const oaiMessages = messages.map(toOAIMessage);

    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: this.config.model,
      messages: oaiMessages,
      stream: true,
      ...(tools.length > 0
        ? {
            tools: tools.map((t) => ({
              type: 'function' as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            })),
            tool_choice: 'auto',
          }
        : {}),
    };

    // o-series reasoning
    if (thinkMode && this.config.model.startsWith('o')) {
      (requestParams as { reasoning_effort?: string }).reasoning_effort = 'high';
    }

    const stream = await this.client.chat.completions.create(requestParams);

    // Accumulate tool call arguments across streaming chunks
    const toolBuffers = new Map<number, ToolBuffer>();
    let stopReason: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      // Text content
      if (delta.content) {
        yield { type: 'text_delta', delta: delta.content };
      }

      // Reasoning content (o-series)
      const reasoningDelta = (delta as Record<string, unknown>)['reasoning_content'];
      if (typeof reasoningDelta === 'string' && reasoningDelta) {
        yield { type: 'thinking_delta', delta: reasoningDelta };
      }

      // Tool call argument streaming
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolBuffers.has(idx)) {
            toolBuffers.set(idx, {
              id: tc.id ?? `call_${idx}`,
              name: tc.function?.name ?? '',
              argBuffer: '',
            });
          }
          const buf = toolBuffers.get(idx)!;
          if (tc.id) buf.id = tc.id;
          if (tc.function?.name) buf.name += tc.function.name;
          if (tc.function?.arguments) buf.argBuffer += tc.function.arguments;
        }
      }

      if (choice.finish_reason) {
        stopReason = choice.finish_reason;
      }
    }

    // Emit complete tool calls
    if (toolBuffers.size > 0) {
      for (const buf of toolBuffers.values()) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(buf.argBuffer || '{}') as Record<string, unknown>;
        } catch {
          args = { _raw: buf.argBuffer };
        }
        const call: ToolCall = { id: buf.id, name: buf.name, arguments: args };
        yield { type: 'tool_call_ready', call };
      }
    }

    // Emit stop
    const reason = normalizeStopReason(stopReason);
    yield { type: 'stop', reason };
  }
}

function normalizeStopReason(r: string | null): StopReason {
  const map: Record<string, StopReason> = {
    stop: 'end_turn',
    tool_calls: 'tool_use',
    length: 'max_tokens',
    content_filter: 'stop_sequence',
  };
  return map[r ?? 'stop'] ?? 'end_turn';
}

function toOAIMessage(msg: Message): OpenAI.Chat.ChatCompletionMessageParam {
  switch (msg.role) {
    case 'system':
      return { role: 'system', content: msg.content };
    case 'user':
      return { role: 'user', content: msg.content };
    case 'assistant': {
      const m: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: msg.content || null,
      };
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        m.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }
      return m;
    }
    case 'tool':
      return {
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: msg.content,
      };
  }
}
