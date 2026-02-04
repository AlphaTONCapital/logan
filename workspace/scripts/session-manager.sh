#!/bin/bash
# Session Manager for OpenClaw/Aton
# Comprehensive session management with local storage

SESSIONS_DIR="$HOME/.openclaw/agents/aton/sessions"
ARCHIVE_DIR="$SESSIONS_DIR/archive"
SUMMARIES_DIR="$SESSIONS_DIR/summaries"
CONTEXT_FILE="$SESSIONS_DIR/persistent-context.json"
MAX_SESSION_SIZE_KB=300  # Archive sessions larger than 300KB
LOG_FILE="$HOME/.openclaw/logs/session-manager.log"

# Create directories
mkdir -p "$ARCHIVE_DIR" "$SUMMARIES_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Initialize persistent context if not exists
init_context() {
    if [ ! -f "$CONTEXT_FILE" ]; then
        cat > "$CONTEXT_FILE" << 'EOF'
{
  "version": 1,
  "lastUpdate": null,
  "activeProjects": [],
  "recentTopics": [],
  "userPreferences": {},
  "sessionHistory": []
}
EOF
        log "Initialized persistent context file"
    fi
}

# Extract summary from session before archiving
extract_summary() {
    local session_file="$1"
    local session_id=$(basename "$session_file" .jsonl)
    local summary_file="$SUMMARIES_DIR/${session_id}-summary.md"

    log "Extracting summary from $session_id..."

    # Get basic stats
    local message_count=$(wc -l < "$session_file" | tr -d ' ')
    local size_kb=$(du -k "$session_file" | cut -f1)
    local first_time=$(head -1 "$session_file" | jq -r '.timestamp // .time // "unknown"' 2>/dev/null)
    local last_time=$(tail -1 "$session_file" | jq -r '.timestamp // .time // "unknown"' 2>/dev/null)

    # Extract key topics (tool calls, user messages)
    local topics=$(grep -o '"tool":"[^"]*"' "$session_file" 2>/dev/null | sort | uniq -c | sort -rn | head -10)

    cat > "$summary_file" << EOF
# Session Summary: $session_id

**Created:** $(date '+%Y-%m-%d %H:%M:%S')
**Original Size:** ${size_kb}KB
**Message Count:** $message_count
**Time Range:** $first_time to $last_time

## Top Tool Usage
\`\`\`
$topics
\`\`\`

## Archive Location
\`archive/${session_id}.jsonl.gz\`
EOF

    log "Summary saved to $summary_file"
}

# Archive and compress session
archive_session() {
    local session_file="$1"
    local filename=$(basename "$session_file")
    local session_id="${filename%.jsonl}"

    # Extract summary first
    extract_summary "$session_file"

    # Compress and archive
    local archive_name="${filename}.gz"
    gzip -c "$session_file" > "$ARCHIVE_DIR/$archive_name"
    log "Compressed to archive/$archive_name"

    # Update persistent context
    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    local temp_context=$(mktemp)

    jq --arg sid "$session_id" --arg ts "$timestamp" \
        '.lastUpdate = $ts | .sessionHistory += [{"id": $sid, "archived": $ts}] | .sessionHistory = .sessionHistory[-20:]' \
        "$CONTEXT_FILE" > "$temp_context" 2>/dev/null

    if [ $? -eq 0 ]; then
        mv "$temp_context" "$CONTEXT_FILE"
        log "Updated persistent context"
    else
        rm -f "$temp_context"
    fi

    # Remove original
    rm "$session_file"
    log "Removed original session file"

    # Update sessions.json
    update_sessions_index "$session_id"
}

# Update sessions.json index
update_sessions_index() {
    local session_id="$1"
    local sessions_json="$SESSIONS_DIR/sessions.json"

    if [ -f "$sessions_json" ]; then
        local temp=$(mktemp)
        jq "with_entries(select(.value.sessionId != \"$session_id\"))" "$sessions_json" > "$temp" 2>/dev/null
        if [ $? -eq 0 ]; then
            mv "$temp" "$sessions_json"
            log "Removed $session_id from sessions index"
        else
            rm -f "$temp"
        fi
    fi
}

# Check and archive bloated sessions
check_session_sizes() {
    log "=== Session Size Check ==="
    init_context

    for session_file in "$SESSIONS_DIR"/*.jsonl; do
        [ -f "$session_file" ] || continue

        size_kb=$(du -k "$session_file" | cut -f1)
        filename=$(basename "$session_file")

        if [ "$size_kb" -gt "$MAX_SESSION_SIZE_KB" ]; then
            log "BLOATED: $filename (${size_kb}KB > ${MAX_SESSION_SIZE_KB}KB)"
            archive_session "$session_file"
        else
            log "OK: $filename (${size_kb}KB)"
        fi
    done
}

# Check gateway health
check_gateway_health() {
    log "=== Gateway Health Check ==="

    if ! pgrep -f "openclaw-gateway" > /dev/null; then
        log "ERROR: Gateway not running!"
        return 1
    fi

    # Check for recent timeouts
    local timeout_count=$(tail -100 "$HOME/.openclaw/logs/gateway.err.log" 2>/dev/null | grep -c "embedded run timeout")
    if [ "$timeout_count" -gt 3 ]; then
        log "WARNING: $timeout_count recent timeouts - may need restart"
        return 2
    fi

    # Check memory usage
    local mem_usage=$(ps -o rss= -p $(pgrep -f openclaw-gateway) 2>/dev/null | awk '{print int($1/1024)}')
    if [ -n "$mem_usage" ]; then
        log "Gateway memory: ${mem_usage}MB"
        if [ "$mem_usage" -gt 1000 ]; then
            log "WARNING: High memory usage (${mem_usage}MB)"
            return 3
        fi
    fi

    log "Gateway health: OK"
    return 0
}

# Auto-restart if unhealthy
auto_restart() {
    check_gateway_health
    local status=$?

    if [ $status -eq 1 ]; then
        log "Starting gateway..."
        launchctl kickstart gui/$(id -u)/ai.openclaw.gateway
        sleep 3
    elif [ $status -ge 2 ]; then
        log "Restarting unhealthy gateway..."
        launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
        sleep 3
    fi
}

# Clean old archives (keep last 20)
clean_old_archives() {
    log "=== Archive Cleanup ==="

    # Clean old compressed archives
    local archive_count=$(ls -1 "$ARCHIVE_DIR"/*.gz 2>/dev/null | wc -l)
    if [ "$archive_count" -gt 20 ]; then
        ls -1t "$ARCHIVE_DIR"/*.gz | tail -n +21 | xargs rm -f
        log "Removed $((archive_count - 20)) old archives"
    fi

    # Clean old summaries
    local summary_count=$(ls -1 "$SUMMARIES_DIR"/*.md 2>/dev/null | wc -l)
    if [ "$summary_count" -gt 30 ]; then
        ls -1t "$SUMMARIES_DIR"/*.md | tail -n +31 | xargs rm -f
        log "Removed $((summary_count - 30)) old summaries"
    fi

    # Report storage usage
    local total_archives=$(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1)
    local total_summaries=$(du -sh "$SUMMARIES_DIR" 2>/dev/null | cut -f1)
    log "Storage: archives=$total_archives, summaries=$total_summaries"
}

# Show status
show_status() {
    echo "=== OpenClaw Session Manager Status ==="
    echo ""

    # Active sessions
    echo "Active Sessions:"
    for f in "$SESSIONS_DIR"/*.jsonl; do
        [ -f "$f" ] || continue
        size=$(du -h "$f" | cut -f1)
        name=$(basename "$f")
        echo "  - $name ($size)"
    done

    echo ""
    echo "Archives: $(ls -1 "$ARCHIVE_DIR"/*.gz 2>/dev/null | wc -l | tr -d ' ') files"
    echo "Summaries: $(ls -1 "$SUMMARIES_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ') files"

    echo ""
    echo "Gateway: $(pgrep -f openclaw-gateway > /dev/null && echo "Running" || echo "Stopped")"

    if [ -f "$CONTEXT_FILE" ]; then
        echo "Last context update: $(jq -r '.lastUpdate // "never"' "$CONTEXT_FILE")"
    fi
}

# Main
case "${1:-status}" in
    check)
        check_session_sizes
        check_gateway_health
        ;;
    clean)
        check_session_sizes
        clean_old_archives
        ;;
    restart)
        auto_restart
        ;;
    status)
        show_status
        ;;
    watch)
        log "Starting session watch (Ctrl+C to stop)..."
        while true; do
            check_session_sizes
            check_gateway_health
            clean_old_archives
            sleep 300
        done
        ;;
    *)
        echo "Usage: $0 {status|check|clean|restart|watch}"
        echo ""
        echo "  status  - Show current session status"
        echo "  check   - Check session sizes and gateway health"
        echo "  clean   - Check + clean old archives"
        echo "  restart - Auto-restart gateway if unhealthy"
        echo "  watch   - Continuous monitoring (every 5 min)"
        exit 1
        ;;
esac

log "=== Session manager completed ==="
