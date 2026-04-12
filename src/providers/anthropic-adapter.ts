import Anthropic from '@anthropic-ai/sdk';
import type {
  ProviderAdapter,
  StreamEvent,
  Message,
  ToolDefinition,
  ToolCall,
  StopReason,
} from './types.js';
import type { ResolvedConfig } from '../config/types.js';

export class AnthropicAdapter implements ProviderAdapter {
  private client: Anthropic;
  private config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
    });
  }

  async *stream(
    messages: Message[],
    tools: ToolDefinition[],
    thinkMode: boolean,
    thinkBudget: number,
  ): AsyncGenerator<StreamEvent> {
    // Separate system messages
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const anthropicMessages = nonSystemMessages.map(toAnthropicMessage);

    const params: Anthropic.Messages.MessageStreamParams = {
      model: this.config.model,
      max_tokens: thinkMode ? thinkBudget + 4096 : 8192,
      messages: anthropicMessages,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      ...(tools.length > 0
        ? {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters,
            })),
          }
        : {}),
      ...(thinkMode
        ? {
            thinking: {
              type: 'enabled' as const,
              budget_tokens: thinkBudget,
            },
          }
        : {}),
    };

    // Tool call buffers: index → {id, name, argBuffer}
    const toolBuffers = new Map<number, { id: string; name: string; argBuffer: string }>();
    let currentBlockIndex = -1;
    let currentBlockType = '';

    const stream = this.client.messages.stream(params);

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start': {
          currentBlockIndex = event.index;
          const block = event.content_block;
          currentBlockType = block.type;

          if (block.type === 'tool_use') {
            toolBuffers.set(currentBlockIndex, {
              id: block.id,
              name: block.name,
              argBuffer: '',
            });
          }
          break;
        }

        case 'content_block_delta': {
          const delta = event.delta;

          if (delta.type === 'text_delta') {
            yield { type: 'text_delta', delta: delta.text };
          } else if (delta.type === 'thinking_delta') {
            yield { type: 'thinking_delta', delta: delta.thinking };
          } else if (delta.type === 'input_json_delta') {
            const buf = toolBuffers.get(event.index);
            if (buf) buf.argBuffer += delta.partial_json;
          }
          break;
        }

        case 'content_block_stop': {
          // If the stopped block was a tool use, emit the complete tool call
          const buf = toolBuffers.get(event.index);
          if (buf && currentBlockType === 'tool_use') {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(buf.argBuffer || '{}') as Record<string, unknown>;
            } catch {
              args = { _raw: buf.argBuffer };
            }
            const call: ToolCall = { id: buf.id, name: buf.name, arguments: args };
            yield { type: 'tool_call_ready', call };
          }
          break;
        }

        case 'message_delta': {
          if (event.usage) {
            yield {
              type: 'usage',
              input: 0,
              output: event.usage.output_tokens,
            };
          }
          if (event.delta.stop_reason) {
            const reason = normalizeStopReason(event.delta.stop_reason);
            yield { type: 'stop', reason };
          }
          break;
        }

        case 'message_start': {
          if (event.message.usage) {
            yield {
              type: 'usage',
              input: event.message.usage.input_tokens,
              output: 0,
            };
          }
          break;
        }
      }
    }
  }
}

function normalizeStopReason(r: string): StopReason {
  const map: Record<string, StopReason> = {
    end_turn: 'end_turn',
    tool_use: 'tool_use',
    max_tokens: 'max_tokens',
    stop_sequence: 'stop_sequence',
  };
  return map[r] ?? 'end_turn';
}

function toAnthropicMessage(
  msg: Message,
): Anthropic.Messages.MessageParam {
  switch (msg.role) {
    case 'user':
      return { role: 'user', content: msg.content };

    case 'assistant': {
      const content: Anthropic.Messages.ContentBlockParam[] = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
      }
      return { role: 'assistant', content };
    }

    case 'tool':
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            content: msg.content,
          },
        ],
      };

    default:
      // system messages are handled separately
      return { role: 'user', content: msg.content };
  }
}
