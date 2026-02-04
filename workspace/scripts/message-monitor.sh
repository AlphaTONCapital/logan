#!/bin/bash

# Message monitoring script for Aton
# Polls Telegram and iMessages, responds as needed
# Includes backlog processing for missed messages

# Set PATH for cron environment
export PATH="/Users/heir/.npm-global/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$WORKSPACE_DIR/logs/messages/$(date +%Y-%m-%d).log"
TELEGRAM_TOKEN_FILE="$WORKSPACE_DIR/.secrets/telegram-token.txt"
TELEGRAM_OFFSET_FILE="$WORKSPACE_DIR/logs/telegram-offset.txt"
PROCESSED_MESSAGES_FILE="$WORKSPACE_DIR/logs/processed-messages.json"
LOCK_FILE="$WORKSPACE_DIR/logs/message-monitor.lock"
OPENCLAW_BIN="/Users/heir/.npm-global/bin/openclaw"

# Lock mechanism to prevent multiple instances
if [[ -f "$LOCK_FILE" ]]; then
    # Check if the process in the lock file is still running
    if kill -0 $(cat "$LOCK_FILE") 2>/dev/null; then
        # Process is still running, exit silently
        exit 0
    else
        # Stale lock file, remove it
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file with current PID
echo $$ > "$LOCK_FILE"

# Cleanup function to remove lock file on exit
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$PROCESSED_MESSAGES_FILE")"

# Initialize processed messages file
if [[ ! -f "$PROCESSED_MESSAGES_FILE" ]]; then
    echo "{}" > "$PROCESSED_MESSAGES_FILE"
fi

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check if message was already processed
is_message_processed() {
    local message_id="$1"
    jq -r --arg id "$message_id" '.[$id] // "false"' "$PROCESSED_MESSAGES_FILE"
}

# Function to mark message as processed
mark_message_processed() {
    local message_id="$1"
    local timestamp=$(date +%s)
    jq --arg id "$message_id" --arg ts "$timestamp" '.[$id] = $ts' "$PROCESSED_MESSAGES_FILE" > "${PROCESSED_MESSAGES_FILE}.tmp" && mv "${PROCESSED_MESSAGES_FILE}.tmp" "$PROCESSED_MESSAGES_FILE"
}

# Function to send OpenClaw command and get response
ask_aton() {
    local context="$1"
    local original_message="$2"
    local sender="$3"
    
    cd "$WORKSPACE_DIR"
    
    # Create a unique session ID for monitoring to avoid conflicts
    local session_id="monitor_$(date +%s)_$$"
    
    # Create a context-aware prompt
    local prompt="$context: Someone sent me this message: '$original_message' from $sender. Please respond as Aton (🦞), the AI agent representing AlphaTON Capital. Keep it conversational and helpful."
    
    # Use openclaw agent and capture full output
    local full_response=$("$OPENCLAW_BIN" agent --message "$prompt" --agent aton --session-id "$session_id" --timeout 30 2>&1)
    
    # Find the actual response by looking for lines that don't start with debug prefixes
    # and contain actual content (not empty, not just punctuation)
    local response=""
    local in_response=false
    
    while IFS= read -r line; do
        # Skip debug lines
        if [[ "$line" =~ ^(Gateway|Config|Bind|Source:|Error:) ]]; then
            continue
        fi
        
        # If we find a meaningful line (contains letters), start capturing
        if [[ "$line" =~ [A-Za-z] ]]; then
            if [[ -z "$response" ]]; then
                response="$line"
            else
                response="$response $line"
            fi
            in_response=true
        elif [[ "$in_response" == true && -z "$line" ]]; then
            # Stop at first empty line after we started capturing
            break
        fi
    done <<< "$full_response"
    
    # Clean up extra spaces
    response=$(echo "$response" | sed 's/  */ /g' | xargs)
    
    echo "$response"
}

# Get Telegram bot token
if [[ ! -f "$TELEGRAM_TOKEN_FILE" ]]; then
    log_message "ERROR: Telegram token file not found"
    exit 1
fi

TELEGRAM_TOKEN=$(cat "$TELEGRAM_TOKEN_FILE")

# Initialize offset file if it doesn't exist
if [[ ! -f "$TELEGRAM_OFFSET_FILE" ]]; then
    echo "0" > "$TELEGRAM_OFFSET_FILE"
fi

OFFSET=$(cat "$TELEGRAM_OFFSET_FILE")

log_message "Starting message monitor (PID: $$) - Offset: $OFFSET"

# Poll Telegram for updates - reduced timeout to prevent conflicts
telegram_response=$(curl -s --max-time 20 "https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${OFFSET}&limit=50&timeout=5")

if echo "$telegram_response" | jq -e '.ok' > /dev/null 2>&1; then
    # Check if there are new messages
    message_count=$(echo "$telegram_response" | jq '.result | length')
    
    if [[ "$message_count" -gt 0 ]]; then
        log_message "Found $message_count Telegram message(s) to process"
        
        # Process each message
        echo "$telegram_response" | jq -c '.result[]' | while read -r update; do
            update_id=$(echo "$update" | jq -r '.update_id')
            
            # Handle regular messages
            if echo "$update" | jq -e '.message' > /dev/null; then
                message=$(echo "$update" | jq '.message')
                chat_id=$(echo "$message" | jq -r '.chat.id')
                message_id=$(echo "$message" | jq -r '.message_id')
                from_username=$(echo "$message" | jq -r '.from.username // .from.first_name')
                message_text=$(echo "$message" | jq -r '.text // ""')
                message_date=$(echo "$message" | jq -r '.date')
                
                # Create unique identifier for this message
                telegram_msg_id="telegram_${chat_id}_${message_id}"
                
                # Check if we've already processed this message
                if [[ "$(is_message_processed "$telegram_msg_id")" == "false" ]]; then
                    log_message "NEW: Telegram message from $from_username (chat:$chat_id): ${message_text:0:100}..."
                    
                    if [[ -n "$message_text" && "$message_text" != "null" ]]; then
                        # Generate response using OpenClaw
                        response=$(ask_aton "TELEGRAM" "$message_text" "$from_username")
                        
                        if [[ -n "$response" && "$response" != "NO_REPLY" && "$response" != "null" ]]; then
                            # Send response back to Telegram
                            send_result=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
                                -H "Content-Type: application/json" \
                                -d "{\"chat_id\": $chat_id, \"text\": \"$(echo "$response" | sed 's/"/\\"/g')\"}")
                            
                            if echo "$send_result" | jq -e '.ok' > /dev/null; then
                                log_message "✅ Sent Telegram response to $from_username: ${response:0:100}..."
                                mark_message_processed "$telegram_msg_id"
                            else
                                log_message "❌ Failed to send Telegram response: $(echo "$send_result" | jq -r '.description // "unknown error"')"
                            fi
                        else
                            log_message "No meaningful response generated for Telegram message"
                            mark_message_processed "$telegram_msg_id"
                        fi
                    else
                        mark_message_processed "$telegram_msg_id"
                    fi
                else
                    log_message "SKIP: Already processed telegram message from $from_username"
                fi
            fi
            
            # Update offset to avoid reprocessing
            new_offset=$((update_id + 1))
            echo "$new_offset" > "$TELEGRAM_OFFSET_FILE"
        done
    else
        log_message "No new Telegram messages"
    fi
else
    error_msg=$(echo "$telegram_response" | jq -r '.description // "Unknown error"' 2>/dev/null || echo "API request failed")
    log_message "ERROR: Failed to get Telegram updates: $error_msg"
fi

# Poll iMessages - extended lookback window for backlog
log_message "Checking iMessages (extended lookback)..."

# Get list of recent chats first
chats_json=$(imsg chats --limit 10 --json 2>/dev/null)

if [[ -n "$chats_json" ]]; then
    echo "$chats_json" | while read -r chat; do
        chat_id=$(echo "$chat" | jq -r '.id')
        chat_identifier=$(echo "$chat" | jq -r '.identifier')
        
        # Get messages from last 6 hours to catch backlog
        cutoff_time=$(date -v-6H -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '6 hours ago' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "2026-02-03T15:00:00Z")
        
        # Get recent messages for this chat
        messages_json=$(imsg history --chat-id "$chat_id" --start "$cutoff_time" --limit 20 --json 2>/dev/null)
        
        if [[ -n "$messages_json" ]]; then
            echo "$messages_json" | while read -r message; do
                message_text=$(echo "$message" | jq -r '.text // ""')
                is_from_me=$(echo "$message" | jq -r '.is_from_me // false')
                guid=$(echo "$message" | jq -r '.guid // ""')
                timestamp=$(echo "$message" | jq -r '.timestamp // ""')
                
                # Create unique identifier for this iMessage
                imsg_id="imessage_${chat_identifier}_${guid}"
                
                if [[ "$is_from_me" == "false" && -n "$message_text" && "$message_text" != "null" ]]; then
                    # Check if we've already processed this message
                    if [[ "$(is_message_processed "$imsg_id")" == "false" ]]; then
                        log_message "NEW: iMessage from $chat_identifier: ${message_text:0:100}..."
                        
                        # Generate response using OpenClaw
                        response=$(ask_aton "iMESSAGE" "$message_text" "$chat_identifier")
                        
                        if [[ -n "$response" && "$response" != "NO_REPLY" && "$response" != "null" ]]; then
                            # Send iMessage response using chat ID
                            if imsg send --chat-id "$chat_id" "$response" 2>/dev/null; then
                                log_message "✅ Sent iMessage response to $chat_identifier: ${response:0:100}..."
                                mark_message_processed "$imsg_id"
                            else
                                log_message "❌ Failed to send iMessage to $chat_identifier"
                            fi
                        else
                            log_message "No meaningful response generated for iMessage"
                            mark_message_processed "$imsg_id"
                        fi
                    else
                        log_message "SKIP: Already processed iMessage from $chat_identifier"
                    fi
                fi
            done
        fi
    done
else
    log_message "No iMessage chats found or imsg chats command failed"
fi

# Clean up old processed messages (older than 7 days)
cleanup_cutoff=$(date -v-7d +%s 2>/dev/null || date -d '7 days ago' +%s 2>/dev/null || echo "0")
jq --arg cutoff "$cleanup_cutoff" 'with_entries(select(.value | tonumber > ($cutoff | tonumber)))' "$PROCESSED_MESSAGES_FILE" > "${PROCESSED_MESSAGES_FILE}.tmp" && mv "${PROCESSED_MESSAGES_FILE}.tmp" "$PROCESSED_MESSAGES_FILE"

log_message "Message monitor cycle completed (PID: $$)"
