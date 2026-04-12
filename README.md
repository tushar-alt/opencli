# AnyOpenCLI

A universal AI coding CLI — configure any AI endpoint and work like Claude Code or Codex. Works with OpenAI, Anthropic, Gemini, Ollama, Groq, Mistral, and any custom endpoint.

## Installation

```bash
npm install -g anyopencli
```

## Quick Start

1. **Configure your provider:**
```bash
anyopencli config use openai  # or anthropic, gemini, ollama, etc.
anyopencli config set apiKey YOUR_API_KEY
```

2. **Start coding:**
```bash
anyopencli
```

## Supported Providers

- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude)
- **Google** (Gemini)
- **Groq**
- **Mistral**
- **Ollama** (local models)
- **Custom** (any OpenAI-compatible endpoint)

## Commands

### Interactive Mode
```bash
anyopencli                 # Start interactive REPL
```

### One-shot Mode
```bash
anyopencli "your prompt here" # Single prompt, then exit
anyopencli "your prompt" -o output.txt  # Save to file
```

### Configuration
```bash
anyopencli config list     # Show current config
anyopencli config get <key> # Get a config value
anyopencli config set <key> <value>  # Set a config value
anyopencli config use <provider>     # Switch provider
anyopencli providers       # List available providers
```

### REPL Commands
Once in interactive mode:
- `/help` - Show available commands
- `/clear` - Clear conversation history
- `/history` - Show conversation turns
- `/model <name>` - Switch model
- `/provider <name>` - Switch provider
- `/think` - Toggle thinking mode
- `/tools` - List enabled tools
- `/config` - Show current configuration
- `/exit` - Quit

## Configuration Files

- **Global:** `~/.anyopencli/config.json`
- **Project:** `.anyopencli.json` (in your project root)

## Environment Variables

You can also set API keys via environment variables:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`
- `ANYOPENCLI_API_KEY` (for custom provider)

## Features

- 🔧 **File operations** - read, write, edit files
- 🔍 **Search** - find files and search content
- 🐚 **Shell commands** - execute with user confirmation
- 🤖 **Multi-provider** - works with any AI endpoint
- 💬 **Interactive** - REPL with conversation history
- 📝 **One-shot** - quick prompts from command line

## License

MIT
