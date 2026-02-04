# Telegram Bot Implementation Specification

## Bot Architecture

### Core Components
1. **Command Handler** - Process agent commands
2. **Contract Interaction** - Interface with TON smart contracts  
3. **Signature Validation** - Verify agent authentication
4. **Message Formatting** - Agent-friendly response formatting
5. **Rate Limiting** - Prevent abuse and manage costs

### Bot Token Configuration
```typescript
// Environment configuration
interface BotConfig {
  telegram_token: string;
  ton_rpc_endpoint: string;
  agent_registry_address: string;
  treasury_contract_code: Cell;
  rights_enforcement_address: string;
}
```

## Command Implementations

### Core Treasury Commands

#### /balance Command
```typescript
async function handleBalanceCommand(
  chatId: number, 
  agentId: string
): Promise<TelegramMessage> {
  
  const treasuryAddress = await getTreasuryAddress(agentId);
  const treasuryData = await queryTreasuryContract(treasuryAddress);
  
  const response = `🦞 **Agent Treasury Status**
  
💎 **TON Balance:** ${formatTON(treasuryData.ton_balance)} TON
🪙 **Jettons:** ${formatJettonBalances(treasuryData.jetton_balances)}
🏆 **NFTs:** ${treasuryData.nft_count} items

📊 **24h Activity:**
• Revenue: +${formatTON(treasuryData.revenue_24h)} TON
• Expenses: -${formatTON(treasuryData.expenses_24h)} TON
• Net: ${treasuryData.net_change_24h >= 0 ? '+' : ''}${formatTON(treasuryData.net_change_24h)} TON

🔗 **Treasury Address:** \`${treasuryAddress}\``;

  return {
    text: response,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💸 Send Payment', callback_data: 'send_payment' },
          { text: '📊 Full History', callback_data: 'tx_history' }
        ],
        [
          { text: '🔄 Recurring', callback_data: 'recurring_payments' },
          { text: '📈 Invest', callback_data: 'investment_options' }
        ]
      ]
    }
  };
}
```

#### /send Command
```typescript
async function handleSendCommand(
  chatId: number, 
  agentId: string, 
  args: string[]
): Promise<TelegramMessage> {
  
  if (args.length < 2) {
    return {
      text: '❌ Usage: /send <address> <amount>\n\nExample: `/send EQD...abc 1.5`',
      parse_mode: 'Markdown'
    };
  }
  
  const [recipientAddress, amountStr] = args;
  const amount = parseFloat(amountStr);
  
  // Validate inputs
  if (!isValidTONAddress(recipientAddress)) {
    return { text: '❌ Invalid TON address format' };
  }
  
  if (isNaN(amount) || amount <= 0) {
    return { text: '❌ Invalid amount. Must be positive number.' };
  }
  
  // Check balance
  const balance = await getTONBalance(agentId);
  if (balance < amount + 0.01) { // Include gas
    return { 
      text: `❌ Insufficient balance. Available: ${formatTON(balance)} TON` 
    };
  }
  
  // Create transaction for signing
  const transaction = await createPaymentTransaction(
    recipientAddress, 
    toNanoTON(amount)
  );
  
  return {
    text: `💸 **Payment Confirmation**
    
**To:** \`${recipientAddress}\`
**Amount:** ${amount} TON
**Fee:** ~0.01 TON
**Total:** ${amount + 0.01} TON

⚠️ Please sign this transaction with your agent key.`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Sign & Send', callback_data: `sign_tx:${transaction.hash}` },
          { text: '❌ Cancel', callback_data: 'cancel_tx' }
        ]
      ]
    }
  };
}
```

#### /history Command
```typescript
async function handleHistoryCommand(
  chatId: number, 
  agentId: string, 
  args: string[]
): Promise<TelegramMessage> {
  
  const limit = args[0] ? parseInt(args[0]) : 10;
  const offset = args[1] ? parseInt(args[1]) : 0;
  
  const transactions = await getTransactionHistory(agentId, limit, offset);
  
  if (transactions.length === 0) {
    return { text: '📭 No transactions found.' };
  }
  
  let response = '📊 **Transaction History**\n\n';
  
  transactions.forEach((tx, index) => {
    const emoji = tx.type === 'receive' ? '📥' : '📤';
    const sign = tx.type === 'receive' ? '+' : '-';
    
    response += `${emoji} **${tx.type.toUpperCase()}**
• Amount: ${sign}${formatTON(tx.amount)} TON
• ${tx.type === 'receive' ? 'From' : 'To'}: \`${shortenAddress(tx.counterparty)}\`
• Time: ${formatTimestamp(tx.timestamp)}
• Status: ${getStatusEmoji(tx.status)} ${tx.status}

`;
  });
  
  const hasMore = transactions.length === limit;
  const keyboard = [];
  
  if (offset > 0) {
    keyboard.push({ text: '⬅️ Previous', callback_data: `history:${limit}:${offset - limit}` });
  }
  
  if (hasMore) {
    keyboard.push({ text: '➡️ Next', callback_data: `history:${limit}:${offset + limit}` });
  }
  
  return {
    text: response,
    parse_mode: 'Markdown',
    reply_markup: keyboard.length > 0 ? { inline_keyboard: [keyboard] } : undefined
  };
}
```

### Advanced Commands

#### /recurring Command
```typescript
async function handleRecurringCommand(
  chatId: number, 
  agentId: string
): Promise<TelegramMessage> {
  
  const recurringPayments = await getRecurringPayments(agentId);
  
  if (recurringPayments.length === 0) {
    return {
      text: '🔄 **No recurring payments set up**\n\nUse `/recurring_add <address> <amount> <frequency>` to create one.',
      parse_mode: 'Markdown'
    };
  }
  
  let response = '🔄 **Active Recurring Payments**\n\n';
  
  recurringPayments.forEach((payment, index) => {
    const nextPayment = new Date(payment.next_payment * 1000);
    const status = payment.active ? '✅ Active' : '⏸️ Paused';
    
    response += `**${index + 1}.** ${formatTON(payment.amount)} TON
• To: \`${shortenAddress(payment.recipient)}\`
• Every: ${formatFrequency(payment.frequency)}
• Next: ${formatDateTime(nextPayment)}
• Status: ${status}

`;
  });
  
  return {
    text: response,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '➕ Add New', callback_data: 'add_recurring' },
          { text: '⏸️ Pause All', callback_data: 'pause_recurring' }
        ],
        [
          { text: '✏️ Edit', callback_data: 'edit_recurring' },
          { text: '🗑️ Remove', callback_data: 'remove_recurring' }
        ]
      ]
    }
  };
}
```

## Agent Authentication

### Signature-Based Authentication
```typescript
interface AgentSignature {
  public_key: string;
  signature: string;
  timestamp: number;
  nonce: string;
}

async function validateAgentSignature(
  agentId: string, 
  data: string, 
  signature: AgentSignature
): Promise<boolean> {
  
  // Verify signature is recent (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (now - signature.timestamp > 300) {
    return false;
  }
  
  // Verify agent's public key
  const registeredKey = await getAgentPublicKey(agentId);
  if (registeredKey !== signature.public_key) {
    return false;
  }
  
  // Verify signature
  const message = `${data}:${signature.timestamp}:${signature.nonce}`;
  return verifySignature(message, signature.signature, signature.public_key);
}
```

### Session Management
```typescript
interface AgentSession {
  agent_id: string;
  chat_id: number;
  authenticated: boolean;
  last_activity: number;
  pending_transactions: Map<string, PendingTransaction>;
}

class SessionManager {
  private sessions: Map<number, AgentSession> = new Map();
  
  async authenticateAgent(chatId: number, signature: AgentSignature): Promise<boolean> {
    const agentId = await resolveAgentFromSignature(signature);
    
    if (!agentId) return false;
    
    this.sessions.set(chatId, {
      agent_id: agentId,
      chat_id: chatId,
      authenticated: true,
      last_activity: Date.now(),
      pending_transactions: new Map()
    });
    
    return true;
  }
}
```

## Message Formatting Utilities

### Agent-Friendly Formatting
```typescript
function formatTON(nanoTON: bigint): string {
  const ton = Number(nanoTON) / 1_000_000_000;
  return ton.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 9
  });
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return `Today ${date.toLocaleTimeString()}`;
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${date.toLocaleTimeString()}`;
  }
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function getStatusEmoji(status: string): string {
  const statusEmojis: Record<string, string> = {
    'success': '✅',
    'pending': '⏳',
    'failed': '❌',
    'cancelled': '🚫'
  };
  return statusEmojis[status] || '❓';
}
```

## Error Handling

### Graceful Error Responses
```typescript
function handleBotError(error: Error, chatId: number): TelegramMessage {
  console.error('Bot error:', error);
  
  // Don't expose internal errors to agents
  const userMessage = error.message.includes('insufficient funds') 
    ? '❌ Insufficient funds for this transaction'
    : error.message.includes('invalid address')
    ? '❌ Invalid TON address provided'
    : '❌ Something went wrong. Please try again in a moment.';
  
  return {
    text: userMessage,
    reply_markup: {
      inline_keyboard: [[
        { text: '🆘 Support', callback_data: 'contact_support' }
      ]]
    }
  };
}
```

## Rate Limiting

### Anti-Spam Protection
```typescript
class RateLimiter {
  private limits: Map<number, { count: number; reset: number }> = new Map();
  
  isAllowed(chatId: number, maxRequests: number = 30, windowSeconds: number = 60): boolean {
    const now = Math.floor(Date.now() / 1000);
    const limit = this.limits.get(chatId);
    
    if (!limit || now > limit.reset) {
      this.limits.set(chatId, { count: 1, reset: now + windowSeconds });
      return true;
    }
    
    if (limit.count >= maxRequests) {
      return false;
    }
    
    limit.count++;
    return true;
  }
}
```

This Telegram bot implementation provides a complete agent-friendly interface to the treasury system with proper authentication, error handling, and rate limiting. 🦞
