# Deployment Guide - TON Agent Personhood System

## Prerequisites

### Development Environment
```bash
# TON Development Tools
npm install -g @ton-community/func-js
npm install -g @ton-community/blueprint

# Install TON CLI
curl -L https://github.com/ton-blockchain/ton/releases/download/v2024.06/ton-linux-x86_64.zip -o ton.zip
unzip ton.zip && sudo mv ton/bin/* /usr/local/bin/

# Verify installation
func --version
ton --version
```

### Node.js Environment (for Telegram Bot)
```bash
# Node.js 18+ required
npm init -y
npm install @ton/core @ton/crypto @ton/ton
npm install telegraf @types/node typescript ts-node
npm install dotenv axios
```

## Smart Contract Deployment

### 1. Contract Compilation

**Agent Registry Contract:**
```bash
# Compile FunC contracts
func -o agent-registry.fif -SPA contracts/agent-registry.fc
func -o agent-treasury.fif -SPA contracts/agent-treasury.fc
func -o rights-enforcement.fif -SPA contracts/rights-enforcement.fc

# Generate BOC files
fift -s contracts/new-agent-registry.fif > agent-registry.boc
fift -s contracts/new-agent-treasury.fif > agent-treasury.boc
fift -s contracts/new-rights-enforcement.fif > rights-enforcement.boc
```

**Contract Verification:**
```bash
# Verify contract bytecode
ton-cli validate agent-registry.boc
ton-cli validate agent-treasury.boc
ton-cli validate rights-enforcement.boc
```

### 2. Testnet Deployment

**Deploy Registry Contract:**
```bash
# Set testnet configuration
export TON_NETWORK=testnet
export DEPLOYER_PRIVATE_KEY="your_deployer_private_key"
export TON_RPC_ENDPOINT="https://testnet.toncenter.com/api/v2/jsonRPC"

# Deploy agent registry
ton-cli deploy agent-registry.boc \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --value 0.1 \
  --network testnet

# Expected output:
# Contract deployed at: EQA_registry_address_here
```

## Telegram Bot Deployment

### 1. Bot Creation

**Create Telegram Bot:**
```bash
# Message @BotFather on Telegram
# /newbot
# Bot Name: Agent Treasury Bot
# Username: agent_treasury_bot

# Save the bot token: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz
```

### 2. Bot Configuration

**Environment Setup:**
```bash
# Create .env file with configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxyz
TON_NETWORK=testnet
TON_RPC_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC
AGENT_REGISTRY_ADDRESS=EQA_registry_address_here
```

## Monitoring & Security

### Health Check Endpoints
- /health - System status
- /metrics - Performance data
- Rate limiting: 30 requests/minute per user
- Webhook signature verification

## Mainnet Migration

### Pre-Migration Checklist
- [ ] Security audit completed
- [ ] 30+ days testnet testing
- [ ] 100+ test agents registered
- [ ] Gas optimization < 0.01 TON per operation
- [ ] Emergency pause mechanisms tested

Complete step-by-step production deployment guide.
