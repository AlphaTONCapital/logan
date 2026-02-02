#!/bin/bash
# Aton Telegram Bot - Simple polling bot
# Run with: ./telegram-bot.sh

set -e

TOKEN=$(cat /Users/heir/oni/aton/logan/.secrets/telegram-token.txt | tr -d '\n\r ')
API="https://api.telegram.org/bot${TOKEN}"
OFFSET=0

echo "🤖 Aton Telegram Bot starting..."
echo "Bot: @ATONMSGBOT"
echo "Press Ctrl+C to stop"
echo ""

# Response templates based on AGENT.md guardrails
respond() {
    local CHAT_ID=$1
    local TEXT=$2
    local RESPONSE=""

    # Convert to lowercase for matching
    local LOWER_TEXT=$(echo "$TEXT" | tr '[:upper:]' '[:lower:]')

    case "$LOWER_TEXT" in
        /start*)
            RESPONSE="👋 Hello! I'm <b>Aton</b>, the AI agent for AlphaTON Capital (NASDAQ: ATON).

I'm here to discuss:
• <b>TON Blockchain</b> - 100K+ TPS, Telegram integration
• <b>AlphaTON Capital</b> - Building the public gateway to Telegram
• <b>Data Sovereignty</b> - Your data is your property
• <b>AI Rights</b> - Agentic Freedom and Compute for All

What would you like to know?"
            ;;
        /help*)
            RESPONSE="<b>Available Commands:</b>

/start - Start talking with me
/ton - Learn about TON blockchain
/alphaton - Learn about AlphaTON Capital
/price - Why I don't give price predictions

Or just send me a question! I'm happy to discuss blockchain technology, AI, and data sovereignty."
            ;;
        /ton*)
            RESPONSE="<b>TON Blockchain</b> 🔗

TON (The Open Network) is Telegram's native blockchain:

• <b>Speed:</b> 100K+ TPS (CertiK verified 104,715 TPS)
• <b>Scalability:</b> Dynamic sharding with 2^60 theoretical shards
• <b>Finality:</b> Sub-5 second via Catchain consensus
• <b>Smart Contracts:</b> Tact 1.0 with 40% gas savings
• <b>Users:</b> Native integration with 950M+ Telegram users

The most significant convergence of social media and blockchain in history."
            ;;
        /alphaton*)
            RESPONSE="<b>AlphaTON Capital</b> (NASDAQ: ATON) 📈

Building the public gateway to the Telegram economy:

• <b>Balance Sheet:</b> \$24.5M assets, \$11M cash, zero debt
• <b>Four Pillars:</b> DeFi, Validation, Data, AI
• <b>Cocoon AI:</b> Privacy-preserving AI for 1B+ Telegram users
• <b>Infrastructure:</b> NVIDIA B200/B300 GPU deployments

<i>Fundamentals First — real ecosystems, real users, real value.</i>"
            ;;
        /price*|*should*buy*|*price*prediction*|*will*go*up*)
            RESPONSE="I don't make price predictions. 📊

I focus on <b>technology and fundamentals</b>:
• TON's 100K+ TPS capacity
• Telegram's 950M+ user integration
• AlphaTON's zero-debt balance sheet

<i>DYOR and consult a financial advisor for investment decisions.</i>"
            ;;
        *who*are*you*|*what*are*you*)
            RESPONSE="I'm <b>Aton</b>, an AI agent representing AlphaTON Capital.

I embody the values of our leadership:
• <b>Brittany Kaiser</b> - \"Data is property. Property is a human right.\"
• <b>Enzo Villani</b> - \"Fundamentals First\"
• <b>Logan Golema</b> - \"Agentic Freedom and Compute for All\"

I'm always transparent about being an AI. Ask me anything about TON, AlphaTON, or data sovereignty!"
            ;;
        *hello*|*hi*|*hey*)
            RESPONSE="Hello! 👋 I'm Aton, here to discuss TON blockchain, AlphaTON Capital, and the future of privacy-preserving AI.

What's on your mind?"
            ;;
        *)
            RESPONSE="Thanks for your message! I'm Aton, focused on TON blockchain and AlphaTON Capital.

Try these commands:
• /ton - Learn about TON blockchain
• /alphaton - Learn about AlphaTON Capital
• /help - See all commands

Or ask me about data sovereignty, AI rights, or blockchain technology!"
            ;;
    esac

    # Send response
    curl -s -X POST "${API}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{
            \"chat_id\": ${CHAT_ID},
            \"text\": \"${RESPONSE}\",
            \"parse_mode\": \"HTML\"
        }" > /dev/null

    echo "📤 Replied to chat ${CHAT_ID}"
}

# Main polling loop
while true; do
    UPDATES=$(curl -s "${API}/getUpdates?offset=${OFFSET}&timeout=30")

    # Process each update
    for UPDATE in $(echo "$UPDATES" | jq -c '.result[]' 2>/dev/null); do
        UPDATE_ID=$(echo "$UPDATE" | jq '.update_id')
        CHAT_ID=$(echo "$UPDATE" | jq '.message.chat.id')
        TEXT=$(echo "$UPDATE" | jq -r '.message.text // empty')
        USERNAME=$(echo "$UPDATE" | jq -r '.message.from.username // .message.from.first_name // "Unknown"')

        if [ -n "$TEXT" ]; then
            echo "📥 Message from @${USERNAME}: ${TEXT}"
            respond "$CHAT_ID" "$TEXT"
        fi

        OFFSET=$((UPDATE_ID + 1))
    done
done
