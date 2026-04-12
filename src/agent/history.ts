import type { Message } from '../providers/types.js';

// Rough token estimate: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 4;

export function estimateTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    total += msg.content.length / CHARS_PER_TOKEN;
    if (msg.role === 'assistant' && msg.toolCalls) {
      total += JSON.stringify(msg.toolCalls).length / CHARS_PER_TOKEN;
    }
  }
  return Math.ceil(total);
}

export function truncateHistory(messages: Message[], maxTokens: number): Message[] {
  // Always keep system message and last N messages
  const system = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  let result = [...system, ...nonSystem];

  // Remove oldest non-system messages until under budget
  while (estimateTokens(result) > maxTokens && nonSystem.length > 2) {
    // Remove the oldest non-system message pair (user + assistant)
    const firstNonSystem = result.findIndex((m) => m.role !== 'system');
    if (firstNonSystem === -1) break;
    result.splice(firstNonSystem, 1);
  }

  return result;
}

export class ConversationHistory {
  private messages: Message[] = [];
  private maxTokens: number;

  constructor(maxTokens = 60_000) {
    this.maxTokens = maxTokens;
  }

  setSystem(content: string): void {
    this.messages = this.messages.filter((m) => m.role !== 'system');
    this.messages.unshift({ role: 'system', content });
  }

  addUser(content: string): void {
    this.messages.push({ role: 'user', content });
    this.trim();
  }

  addMessages(newMessages: Message[]): void {
    this.messages.push(...newMessages);
    this.trim();
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clear(): void {
    const system = this.messages.filter((m) => m.role === 'system');
    this.messages = system;
  }

  getTurnCount(): number {
    return this.messages.filter((m) => m.role === 'user').length;
  }

  private trim(): void {
    if (estimateTokens(this.messages) > this.maxTokens) {
      this.messages = truncateHistory(this.messages, this.maxTokens);
    }
  }
}
