// ── Normalized internal types ──────────────────────────────────────────────
// All provider adapters normalize their output into these types.
// The rest of the app only speaks these types.

export type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_call_ready'; call: ToolCall }
  | { type: 'usage'; input: number; output: number }
  | { type: 'stop'; reason: StopReason };

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'length';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ── Message types ──────────────────────────────────────────────────────────

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface UserMessage {
  role: 'user';
  content: string;
}

export interface AssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolMessage {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  content: string;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// ── Tool definition (JSON schema for the model) ────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ── Adapter interface ──────────────────────────────────────────────────────

export interface ProviderAdapter {
  stream(
    messages: Message[],
    tools: ToolDefinition[],
    thinkMode: boolean,
    thinkBudget: number,
  ): AsyncGenerator<StreamEvent>;
}
