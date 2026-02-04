#!/bin/bash

echo "=== Aton Communication Monitor Status ==="
echo
echo "Cron Jobs:"
crontab -l | grep -v "^#"
echo
echo "Recent Monitor Activity:"
tail -n 10 scripts/monitoring/monitor.log 2>/dev/null || echo "No monitor log yet"
echo
echo "Recent Heartbeats:"
tail -n 5 scripts/monitoring/heartbeat.log 2>/dev/null || echo "No heartbeat log yet"
echo
echo "Active Communication Channels:"
echo "✓ iMessage: $(imsg chats --limit 1 --json | wc -l) active chat(s)"
echo "✓ Telegram Desktop: Connected to $(osascript -e 'tell application "System Events" to tell process "Telegram" to tell window 1 to get name' 2>/dev/null || echo 'Unknown')"
echo "✓ Telegram Bot: @ATONMSGBOT (ID: $(cat .secrets/telegram-token.txt | cut -d: -f1))"
