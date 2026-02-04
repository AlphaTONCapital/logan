# Autonomous Aton Design

**Created:** 2026-02-03
**Status:** Implementing

## Goal

Transform Aton from heartbeat-triggered to fully autonomous:
- 24/7 message monitoring (Telegram + iMessage)
- Continuous work queue processing
- Self-initiating development from GitHub issues
- Proactive improvements when idle

## Environment

- **Mac Studio** - Dedicated always-on server
- **iPhone 17** - Same iCloud account, notifications/communication
- **GitHub** - alphatoncapital (ideas), atoncap (projects)
- **Telegram** - @ATONMSGBOT bot + @atoncrux personal
- **iMessage** - Full desktop control

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     aton-daemon.js                              │
│                  (Single Unified Process)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Telegram    │  │   iMessage   │  │   Work Processor     │  │
│  │  Bot         │  │   Monitor    │  │                      │  │
│  │              │  │              │  │  - Clone repos       │  │
│  │  - Long-poll │  │  - 10s poll  │  │  - Run Claude CLI    │  │
│  │  - /build    │  │  - Smart AI  │  │  - Create PRs        │  │
│  │  - /queue    │  │    replies   │  │  - Notify on done    │  │
│  │  - /projects │  │              │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  GitHub      │  │   Proactive  │  │   Health             │  │
│  │  Scanner     │  │   Generator  │  │   Monitor            │  │
│  │              │  │              │  │                      │  │
│  │  - 5min poll │  │  - When idle │  │  - 60s heartbeat     │  │
│  │  - Auto-queue│  │  - Fix TODOs │  │  - Memory tracking   │  │
│  │    issues    │  │  - Updates   │  │  - Crash recovery    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  launchd (KeepAlive: true)    │
              │  Auto-restart on crash        │
              │  Start on boot                │
              └───────────────────────────────┘
```

## /build Flow (Guaranteed)

1. User sends `/build AI-powered NFT marketplace`
2. **Immediate** (< 30 seconds):
   - Fork `alphatoncapital/ton-scaffolding` → `atoncap/ai-nft-marketplace`
   - Update README with project description
   - Push to origin
   - Reply with repo URL
3. **Queued** (processed continuously):
   - Phase 1: scaffold (basic structure)
   - Phase 2: contracts (Tact/FunC)
   - Phase 3: tests (sandbox tests)
   - Phase 4: scripts (deploy/interact)
   - Phase 5: frontend (React + TON Connect)
   - Phase 6: docs (README, usage)
4. **Notifications**:
   - PR link after each phase
   - Final "all phases complete" message

## Work Limits

| Setting | Value |
|---------|-------|
| Max tasks/day | 20 |
| Queue poll interval | 30 seconds |
| GitHub scan interval | 5 minutes |
| iMessage poll interval | 10 seconds |
| Idle threshold for proactive work | 10 minutes |
| Repo creation cooldown | None (was 1 hour) |

## Files

| File | Purpose |
|------|---------|
| `workspace/bot/aton-daemon.js` | Unified daemon process |
| `~/Library/LaunchAgents/com.alphatoncapital.aton.plist` | launchd config |
| `workspace/scripts/aton-ctl.sh` | Start/stop/status helper |
| `/tmp/aton-daemon.alive` | Health heartbeat file |
| `workspace/bot/aton-memory.db` | SQLite (existing) |

## Safeguards

- All work creates PRs (never direct push to main)
- Guardrails from AGENT.md applied to all responses
- Rate limiting on message responses (10/minute)
- Health monitoring with auto-restart
- Logs to ~/.openclaw/logs/aton-daemon.log

## Implementation Order

1. Create aton-daemon.js with all components
2. Create launchd plist
3. Create aton-ctl.sh helper
4. Test each component
5. Enable and verify 24/7 operation
