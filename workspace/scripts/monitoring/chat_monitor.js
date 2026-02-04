#!/usr/bin/env node

const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const STATE_FILE = 'scripts/monitoring/last_seen.json';
const LOG_FILE = 'scripts/monitoring/chat_monitor.log';

// Load last seen messages
async function loadState() {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { imessage: {}, telegram: {} };
    }
}

// Save last seen messages
async function saveState(state) {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// Log activity
async function log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp}: ${message}\n`;
    await fs.appendFile(LOG_FILE, logEntry);
    console.log(`[${timestamp}] ${message}`);
}

// Check iMessage for new messages
async function checkiMessage() {
    try {
        const { stdout } = await execAsync('imsg chats --json --limit 10');
        if (!stdout.trim()) return [];
        
        const chats = stdout.trim().split('\n').map(line => JSON.parse(line));
        const newMessages = [];
        
        for (const chat of chats) {
            const { stdout: historyOutput } = await execAsync(`imsg history --chat-id ${chat.id} --json --limit 5`);
            if (!historyOutput.trim()) continue;
            
            const messages = historyOutput.trim().split('\n').map(line => JSON.parse(line));
            for (const msg of messages) {
                if (!msg.is_from_me) { // Only respond to messages TO me
                    newMessages.push({
                        platform: 'imessage',
                        chat_id: chat.id,
                        identifier: chat.identifier,
                        message: msg,
                        needs_response: true
                    });
                }
            }
        }
        
        return newMessages;
    } catch (error) {
        await log(`iMessage check error: ${error.message}`);
        return [];
    }
}

// Check Telegram bot API for messages
async function checkTelegram() {
    try {
        const token = (await fs.readFile('.secrets/telegram-token.txt', 'utf8')).trim();
        const { stdout } = await execAsync(`curl -s "https://api.telegram.org/bot${token}/getUpdates?limit=10"`);
        const data = JSON.parse(stdout);
        
        if (!data.ok) return [];
        
        return data.result.filter(update => 
            update.message && 
            !update.message.from.is_bot &&
            update.message.chat.type !== 'channel'
        ).map(update => ({
            platform: 'telegram_bot',
            chat_id: update.message.chat.id,
            update_id: update.update_id,
            message: update.message,
            needs_response: shouldRespond(update.message)
        }));
    } catch (error) {
        await log(`Telegram check error: ${error.message}`);
        return [];
    }
}

// Determine if I should respond to a message
function shouldRespond(message) {
    const text = message.text?.toLowerCase() || '';
    const isDirectMessage = message.chat.type === 'private';
    const mentionsMe = text.includes('@aton') || text.includes('aton');
    const isQuestion = text.includes('?');
    const isGreeting = /^(hi|hello|hey)\b/.test(text);
    
    return isDirectMessage || mentionsMe || (isQuestion && Math.random() > 0.3) || (isGreeting && Math.random() > 0.5);
}

// Send iMessage response
async function respondToiMessage(chatData) {
    const msg = chatData.message;
    let response = generateResponse(msg.text, 'imessage');
    
    try {
        await execAsync(`imsg send --chat-id ${chatData.chat_id} --text "${response}"`);
        await log(`Sent iMessage to ${chatData.identifier}: ${response.substring(0, 50)}...`);
    } catch (error) {
        await log(`Failed to send iMessage: ${error.message}`);
    }
}

// Send Telegram response via desktop app
async function respondToTelegram(chatData) {
    const response = generateResponse(chatData.message.text, 'telegram');
    
    try {
        // Use clipboard method for clean text
        await execAsync(`echo "${response}" | pbcopy`);
        
        // Navigate to the chat and send
        const script = `
        tell application "System Events" to tell process "Telegram"
            tell window 1
                click text field "Search"
                keystroke "${chatData.message.chat.title || chatData.message.from.first_name}"
                delay 1
                key code 36
                click text field "Write a message..."
                key code 9 using command down
                key code 36
            end tell
        end tell
        `;
        
        await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
        await log(`Sent Telegram response: ${response.substring(0, 50)}...`);
    } catch (error) {
        await log(`Failed to send Telegram message: ${error.message}`);
    }
}

// Generate contextual responses
function generateResponse(text, platform) {
    const responses = {
        greeting: [
            "Hello! How can I assist you today?",
            "Hi there! What can I help you with?",
            "Hey! Ready to support whatever you need."
        ],
        question: [
            "Great question! Let me help with that.",
            "I can definitely assist with that.",
            "Happy to help! Here's what I think..."
        ],
        alphaton: [
            "AlphaTON is positioned perfectly as the infrastructure for the Telegram economy.",
            "Our TON ecosystem work is really exciting with the recent technical milestones.",
            "I'm here to support AlphaTON's strategic initiatives however needed."
        ],
        default: [
            "Thanks for reaching out! How can I be helpful?",
            "I'm here to assist with research, content, or strategic support.",
            "Let me know what you need help with!"
        ]
    };
    
    const lowerText = text.toLowerCase();
    
    if (/^(hi|hello|hey)\b/.test(lowerText)) {
        return responses.greeting[Math.floor(Math.random() * responses.greeting.length)];
    } else if (lowerText.includes('alphaton') || lowerText.includes('ton')) {
        return responses.alphaton[Math.floor(Math.random() * responses.alphaton.length)];
    } else if (lowerText.includes('?')) {
        return responses.question[Math.floor(Math.random() * responses.question.length)];
    } else {
        return responses.default[Math.floor(Math.random() * responses.default.length)];
    }
}

// Main monitoring function
async function monitor() {
    try {
        await log('Starting chat monitoring cycle...');
        
        const state = await loadState();
        
        // Check all platforms
        const imessageMessages = await checkiMessage();
        const telegramMessages = await checkTelegram();
        
        const allMessages = [...imessageMessages, ...telegramMessages];
        
        // Process new messages
        for (const msgData of allMessages) {
            if (msgData.needs_response) {
                if (msgData.platform === 'imessage') {
                    await respondToiMessage(msgData);
                } else if (msgData.platform === 'telegram_bot') {
                    await respondToTelegram(msgData);
                }
                
                // Small delay between responses
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        await log(`Monitoring cycle complete. Processed ${allMessages.length} messages.`);
        
    } catch (error) {
        await log(`Monitor error: ${error.message}`);
    }
}

// Run the monitor
monitor().catch(console.error);
