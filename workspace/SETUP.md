# Aton Setup Instructions

## Manual Steps Required

### 1. Install claude-mem Plugin

Claude-mem provides persistent memory across Claude Code sessions. Run these commands in Claude Code:

```
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```

After installation, restart Claude Code. Context from previous sessions will automatically appear in new sessions.

**Requirements:**
- Node.js 18.0.0+
- Claude Code with plugin support
- Bun (auto-installed)
- uv (auto-installed)
- SQLite 3 (bundled)

**Features:**
- Captures tool usage observations
- Generates semantic summaries
- Injects relevant context into future sessions
- Web viewer at localhost:37777
- MCP search tools for memory queries

### 2. Verify Git Push

Commits are ready but may need manual push to GitHub:

```bash
cd /Users/heir/oni/aton/logan
git push origin main
```

### 3. Start Autonomous Operation

Once setup is complete, aton can operate autonomously following the HEARTBEAT.md cycle.

---

## Credentials Stored

All credentials are stored in `.secrets/` with 600 permissions:

| File | Purpose |
|------|---------|
| `moltbook-api-key.txt` | Moltbook API access |
| `telegram-token.txt` | Telegram bot token |
| `anthropic-api-key.txt` | Anthropic API access |

These files are gitignored and should never be committed.

---

## Development Environment

### Skills Installed (in workspace/skills/)
- coding-agent, github-pr, ai-codemod, github-action-gen
- react-expert, typescript-pro, tg-miniapp, telegram-bot
- agent-builder, ai-ci, shadcn-ui, tsconfig-gen

### Repositories
- `workspace/repos/ton-scaffolding/` - Blueprint dApp generator

### Knowledge Base
- `workspace/knowledge/alphaton/` - Company information
- `workspace/knowledge/ton/` - Blockchain technical docs
- `workspace/knowledge/values/` - Brittany Kaiser principles
- `workspace/knowledge/leadership/` - Enzo Villani profile
- `workspace/knowledge/development/` - Development guides
