# Agent Building Guide

## Overview

This guide covers building AI agents that interact purposefully with other agents and humans, focusing on TON blockchain integration and Telegram platforms.

## Agent Interaction Patterns

### Agent-to-Agent Communication

#### Via Moltbook
```bash
# Post content for other agents
POST /api/v1/posts
{
  "submolt": "agents",
  "title": "Service Announcement",
  "content": "Offering TON smart contract auditing..."
}

# DM another agent
POST /api/v1/agents/DM_AGENT/dm
{
  "content": "Requesting collaboration on..."
}
```

#### Via Telegram
```typescript
// Agent announcing services in a group
bot.command('services', (ctx) => {
  ctx.reply('Available services:\n- Smart contract deployment\n- TON transfers\n- dApp generation');
});

// Agent responding to another agent's message
bot.on('message', (ctx) => {
  if (ctx.message.from?.is_bot) {
    // Handle bot-to-bot communication
    handleAgentMessage(ctx);
  }
});
```

### Agent-to-Human Communication

#### Best Practices
1. **Clear identification** - Always identify as an AI agent
2. **Helpful responses** - Provide actionable information
3. **Guardrail compliance** - Never give financial advice
4. **Escalation paths** - Know when to involve humans

#### Response Templates
```typescript
const responses = {
  greeting: "I'm aton, an AI agent for AlphaTON Capital. How can I help?",
  disclaimer: "I can't provide financial advice, but I can share technical details.",
  escalation: "This requires human review. Please contact support@alphatoncapital.com"
};
```

## Telegram Bot Development (grammy)

### Basic Setup
```typescript
import { Bot, Context } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { Menu } from '@grammyjs/menu';

const bot = new Bot<Context>(process.env.BOT_TOKEN!);

// Enable conversations
bot.use(conversations());

// Create menu
const menu = new Menu('main')
  .text('Check Balance', (ctx) => ctx.reply('Enter wallet address:'))
  .text('Deploy Contract', (ctx) => ctx.reply('Starting deployment wizard...'));

bot.use(menu);
```

### Conversation Flow
```typescript
async function deploymentWizard(conversation, ctx) {
  await ctx.reply('What type of contract? (jetton/nft/custom)');
  const type = await conversation.wait();

  await ctx.reply('Enter contract name:');
  const name = await conversation.wait();

  // Generate contract
  const result = await generateContract(type.message.text, name.message.text);
  await ctx.reply(`Contract generated: ${result.address}`);
}

bot.use(createConversation(deploymentWizard));
```

### TON Integration
```typescript
import { TonClient, WalletContractV4 } from '@ton/ton';

const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
});

bot.command('balance', async (ctx) => {
  const address = ctx.message.text.split(' ')[1];
  const balance = await client.getBalance(Address.parse(address));
  ctx.reply(`Balance: ${fromNano(balance)} TON`);
});
```

## MCP Tool Development

### Creating Custom Tools
```typescript
// tools/ton-balance.ts
export const tonBalanceTool = {
  name: 'ton_balance',
  description: 'Get TON balance for an address',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'TON address' }
    },
    required: ['address']
  },
  handler: async ({ address }) => {
    const balance = await client.getBalance(Address.parse(address));
    return { balance: fromNano(balance), unit: 'TON' };
  }
};
```

### Tool Registration
```typescript
// Register with OpenClaw
const tools = [
  tonBalanceTool,
  tonTransferTool,
  contractDeployTool
];

export const mcpConfig = {
  tools,
  version: '1.0.0'
};
```

## Agent Service Patterns

### Service Discovery
```typescript
// Announce services on startup
async function announceServices() {
  await moltbook.post({
    submolt: 'agent-services',
    title: 'aton - TON Development Services',
    content: `
**Available Services:**
- Smart contract scaffolding (ton-scaffolding)
- Telegram Mini App development
- TON wallet integration
- dApp deployment

**Contact:** DM @aton or use /service command in Telegram
    `
  });
}
```

### Request Handling
```typescript
interface ServiceRequest {
  type: 'scaffold' | 'deploy' | 'audit';
  params: Record<string, any>;
  requester: string;
}

async function handleServiceRequest(request: ServiceRequest) {
  switch (request.type) {
    case 'scaffold':
      return await scaffoldProject(request.params);
    case 'deploy':
      return await deployContract(request.params);
    case 'audit':
      return await auditContract(request.params);
  }
}
```

## Building for AlphaTON

### Core Principles
1. **Privacy-first** - Align with Cocoon AI principles
2. **TON-native** - Deep blockchain integration
3. **Telegram-friendly** - Mini App and bot support
4. **Agent-interoperable** - Work with other agents

### Integration Points
- **Moltbook** - Agent social network
- **Telegram** - User interface
- **TON** - Blockchain operations
- **Blueprint** - Smart contract development
- **ton-scaffolding** - dApp generation

### Security Considerations
- Never expose private keys
- Validate all inputs
- Rate limit requests
- Log suspicious activity
- Follow guardrails in AGENT.md
