#!/bin/bash

LOG_FILE="scripts/monitoring/monitor.log"
STATE_FILE="scripts/monitoring/last_check.txt"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check for new iMessages
check_imessage() {
    log "Checking iMessage..."
    
    # Get recent chats and check for new messages
    imsg chats --limit 5 --json | while read -r chat; do
        if [ -n "$chat" ]; then
            chat_id=$(echo "$chat" | jq -r '.id')
            identifier=$(echo "$chat" | jq -r '.identifier')
            
            # Get recent messages from this chat
            recent_messages=$(imsg history --chat-id "$chat_id" --limit 3 --json)
            
            echo "$recent_messages" | while read -r message; do
                if [ -n "$message" ]; then
                    is_from_me=$(echo "$message" | jq -r '.is_from_me')
                    created_at=$(echo "$message" | jq -r '.created_at')
                    text=$(echo "$message" | jq -r '.text')
                    
                    # Only respond to messages TO me (not from me)
                    if [ "$is_from_me" = "false" ]; then
                        log "New iMessage from $identifier: $text"
                        
                        # Simple response logic
                        if [[ "$text" =~ [Hh]ello|[Hh]i|[Hh]ey ]]; then
                            response="Hello! How can I assist you today?"
                        elif [[ "$text" =~ [Aa]lpha[Tt][Oo][Nn]|TON ]]; then
                            response="Happy to discuss AlphaTON and our TON ecosystem work! What would you like to know?"
                        elif [[ "$text" =~ \? ]]; then
                            response="Great question! Let me help with that."
                        else
                            response="Thanks for reaching out! How can I be helpful?"
                        fi
                        
                        # Send response
                        imsg send --chat-id "$chat_id" --text "$response"
                        log "Sent iMessage response to $identifier"
                    fi
                fi
            done
        fi
    done
}

# Check Telegram via desktop app (simplified)
check_telegram() {
    log "Checking Telegram (monitoring active window)..."
    
    # Check if we're in AlphaTON Management and if there are new messages
    current_window=$(osascript -e 'tell application "System Events" to tell process "Telegram" to tell window 1 to get name' 2>/dev/null)
    
    if [[ "$current_window" == *"AlphaTON Management"* ]]; then
        log "In AlphaTON Management group - ready to respond"
        
        # Could add logic here to detect new messages and respond
        # For now, just log that we're monitoring
    fi
}

# Main monitoring loop
main() {
    log "=== Chat Monitor Starting ==="
    
    # Create state file if it doesn't exist
    touch "$STATE_FILE"
    
    check_imessage
    check_telegram
    
    # Update last check time
    date > "$STATE_FILE"
    
    log "=== Monitor Cycle Complete ==="
}

main
