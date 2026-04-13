import { marked } from 'marked';
// @ts-expect-error marked-terminal has no types
import TerminalRenderer from 'marked-terminal';
import chalk from 'chalk';
import { theme } from './theme.js';

// Set up marked with terminal renderer
marked.use(
  new TerminalRenderer({
    code: chalk.cyan,
    blockquote: chalk.gray.italic,
    html: chalk.gray,
    heading: chalk.bold.cyan,
    firstHeading: chalk.bold.cyan,
    hr: chalk.dim,
    listitem: chalk.reset,
    table: chalk.reset,
    paragraph: chalk.reset,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.cyan,
    del: chalk.strikethrough,
    link: chalk.blue.underline,
    href: chalk.blue.underline,
  }),
);

export function stripHtml(html: string): string {
  return html
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<pre><code>/gi, '\n```\n')
    .replace(/<\/code><\/pre>/gi, '```\n')
    .replace(/<code>/gi, '`')
    .replace(/<\/code>/gi, '`')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function renderMarkdown(text: string): string {
  try {
    // Strip HTML tags first (some models return HTML)
    const cleaned = stripHtml(text);
    const result = marked(cleaned);
    return typeof result === 'string' ? result : text;
  } catch {
    return text;
  }
}

/**
 * StreamingRenderer accumulates partial output and renders complete
 * markdown lines/blocks, holding back partial constructs.
 */
export class StreamingRenderer {
  private buffer = '';
  private thinkingBuffer = '';
  private showThinking: boolean;
  private inCodeFence = false;

  constructor(showThinking = false) {
    this.showThinking = showThinking;
  }

  pushText(delta: string): void {
    // Strip HTML from delta immediately as it comes in
    this.buffer += stripHtml(delta);
    this.flush(false);
  }

  pushThinking(delta: string): void {
    this.thinkingBuffer += delta;

    if (this.showThinking) {
      process.stdout.write(theme.thinking(delta));
    }
  }

  /** Flush complete lines/blocks to stdout. If `final`, flush everything. */
  flush(final: boolean): void {
    // If final, also strip any remaining HTML from the buffer
    if (final && this.buffer) {
      this.buffer = stripHtml(this.buffer);
    }

    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in the buffer (unless final)
    const toRender = final ? lines : lines.slice(0, -1);
    this.buffer = final ? '' : (lines[lines.length - 1] ?? '');

    for (const line of toRender) {
      // Track code fence state to avoid rendering mid-fence
      if (line.trimStart().startsWith('```')) {
        this.inCodeFence = !this.inCodeFence;
      }

      if (this.inCodeFence) {
        // Inside code fence: print raw with basic syntax color
        process.stdout.write(chalk.cyan(line) + '\n');
      } else {
        // Render markdown for complete lines outside code fences
        const rendered = renderMarkdown(line + '\n');
        process.stdout.write(rendered);
      }
    }
  }

  end(): void {
    // Flush the remaining buffer
    if (this.buffer) {
      this.flush(true);
    }

    // Show thinking summary if we captured any
    if (this.showThinking && this.thinkingBuffer) {
      process.stdout.write(
        '\n' + theme.thinking(`[Thinking: ${this.thinkingBuffer.length} chars]\n`),
      );
    }
  }

  getThinkingContent(): string {
    return this.thinkingBuffer;
  }
}

/** Print a tool call announcement */
export function printToolCall(name: string, args: Record<string, unknown>): void {
  const shortArgs = summarizeArgs(args);
  process.stdout.write(
    `\n${theme.toolName(`⚙ ${name}`)}${shortArgs ? theme.toolArg(` (${shortArgs})`) : ''}\n`,
  );
}

/** Print tool result */
export function printToolResult(name: string, result: string): void {
  const preview = result.length > 200 ? result.slice(0, 200) + '…' : result;
  process.stdout.write(theme.muted(`  → ${preview}\n`));
}

function summarizeArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '';

  // Show first meaningful arg
  const first = entries[0];
  if (!first) return '';
  const [key, val] = first;
  if (key === 'path' || key === 'command' || key === 'pattern') {
    return String(val);
  }
  return `${key}=${JSON.stringify(val)}`;
}
