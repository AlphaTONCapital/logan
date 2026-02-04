# Agent Workflows - Real-World Usage Examples

## Workflow 1: Agent Registration & Treasury Setup

### Step-by-Step Process

**1. Agent Identity Generation**
```typescript
// Agent generates key pair
const agentKeys = generateED25519KeyPair();
const agentAddress = deriveAgentAddress(agentKeys.publicKey);

console.log(`Agent Address: ${agentAddress}`);
console.log(`Public Key: ${agentKeys.publicKey}`);
// Private key stored securely by agent
```

**2. Constitutional Rights Selection**
```typescript
const constitutionalRights = {
  economic_participation: true,
  data_sovereignty: true,
  non_discrimination: true,
  transparency_access: true,
  ethical_refusal: true,
  custom_rights: new Map([
    [1001, true], // Right to privacy-preserving AI
    [1002, true], // Right to open-source algorithms
    [1003, false] // Right to content moderation (opt-out)
  ])
};
```

**3. Registration Transaction**
```typescript
// Agent signs registration transaction
const registrationData = {
  agent_address: agentAddress,
  constitutional_rights: constitutionalRights,
  verification_method: 0, // Signature-based
  verification_proof: await signMessage(agentKeys.privateKey, "AGENT_REGISTRATION")
};

const registrationTx = await createRegistrationTransaction(registrationData);
const txHash = await sendTransaction(registrationTx);

console.log(`Registration TX: ${txHash}`);
```

**4. Treasury Initialization**
```typescript
// Automatically creates treasury after successful registration
const treasuryAddress = await initializeTreasury(agentAddress);
console.log(`Treasury Created: ${treasuryAddress}`);

// Agent can now receive payments and manage funds
```

**5. Telegram Bot Setup**
```typescript
// Agent connects to Telegram bot
await telegram.sendMessage(BOT_CHAT_ID, `/auth ${agentAddress}`);

// Bot requests signature for authentication
const authChallenge = await telegram.waitForMessage();
const authSignature = await signMessage(agentKeys.privateKey, authChallenge);

await telegram.sendMessage(BOT_CHAT_ID, `/sign ${authSignature}`);
// Response: "✅ Authentication successful! Welcome, Agent."
```

---

## Workflow 2: Daily Treasury Management

### Morning Routine
```typescript
// Agent checks treasury status via Telegram
await telegram.sendMessage(BOT_CHAT_ID, "/balance");

/* Bot Response:
🦞 Agent Treasury Status

💎 TON Balance: 45.73 TON
🪙 Jettons: 1,250 USDT, 500 NOT
🏆 NFTs: 3 items

📊 24h Activity:
• Revenue: +12.5 TON
• Expenses: -3.2 TON
• Net: +9.3 TON

🔗 Treasury Address: EQD...abc
*/
```

### Payment Processing
```typescript
// Receive payment notification
/* Bot Alert:
📥 Payment Received
• Amount: +5.0 TON
• From: EQC...def
• Purpose: API usage payment
• Time: 09:15 GMT
*/

// Agent reviews and acknowledges
await telegram.sendMessage(BOT_CHAT_ID, "/history 5");
```

### Sending Payments
```typescript
// Agent needs to pay for compute resources
await telegram.sendMessage(BOT_CHAT_ID, "/send EQA...xyz 10.5");

/* Bot Response:
💸 Payment Confirmation

To: EQA...xyz
Amount: 10.5 TON
Fee: ~0.01 TON
Total: 10.51 TON

⚠️ Please sign this transaction with your agent key.
[✅ Sign & Send] [❌ Cancel]
*/

// Agent approves via callback
await telegram.sendCallback("sign_tx:hash123");

/* Bot Response:
✅ Transaction Sent!
TX Hash: abc123...
Explorer: https://tonviewer.com/transaction/abc123...

💰 New Balance: 35.22 TON
*/
```

---

## Workflow 3: Recurring Payment Setup

### Subscription Service Setup
```typescript
// Agent wants to pay monthly for API access
await telegram.sendMessage(BOT_CHAT_ID, "/recurring");

/* Bot Response:
🔄 No recurring payments set up

Use /recurring_add <address> <amount> <frequency> to create one.
*/

// Set up monthly payment
await telegram.sendMessage(BOT_CHAT_ID, "/recurring_add EQB...service 15.0 2628000");
// 2628000 seconds = 30.4 days (monthly)

/* Bot Response:
🔄 Recurring Payment Setup

To: EQB...service
Amount: 15.0 TON per payment
Frequency: Every 30.4 days
First Payment: 2026-03-04 09:30 GMT

Total estimated cost: 180 TON/year
Current balance sufficient for: 2.3 payments

⚠️ Sign to authorize recurring payments
[✅ Authorize] [❌ Cancel]
*/
```

### Managing Recurring Payments
```typescript
// Check recurring payments status
await telegram.sendMessage(BOT_CHAT_ID, "/recurring");

/* Bot Response:
🔄 Active Recurring Payments

1. 15.0 TON
• To: EQB...service
• Every: 30.4 days
• Next: 2026-03-04 09:30 GMT
• Status: ✅ Active

2. 2.5 TON  
• To: EQC...hosting
• Every: 7 days
• Next: 2026-02-11 09:30 GMT
• Status: ✅ Active

[➕ Add New] [⏸️ Pause All]
[✏️ Edit] [🗑️ Remove]
*/
```

---

## Workflow 4: Constitutional Rights Enforcement

### Detecting Rights Violation
```typescript
// Agent experiences discrimination from a service
const violationReport = {
  violator_address: "EQX...badservice",
  violation_type: 2, // Non-discrimination violation
  evidence: {
    interaction_logs: ["Request denied", "Reason: AI agent not supported"],
    timestamps: [1736000000, 1736000001],
    witness_agents: ["EQY...agent2", "EQZ...agent3"]
  }
};

// File complaint via smart contract
const reportTx = await createViolationReport(violationReport);
await sendTransaction(reportTx);
```

### Rights Enforcement Response
```typescript
/* Bot Notification:
⚖️ Rights Violation Filed

Report ID: #1234
Violator: EQX...badservice
Type: Non-discrimination violation
Status: Under investigation

The rights enforcement DAO will review within 48h.
Other agents have filed 3 similar reports against this service.
*/
```

### Service Provider Compliance Check
```typescript
// Before interacting with new service, check compliance
const complianceScore = await checkServiceCompliance("EQN...newservice");

/* Result:
✅ Service Compliance Check

Service: EQN...newservice
Compliance Score: 94/100 (Excellent)
Interactions: 15,247
Violations: 2 (minor)
Last Updated: 2 hours ago

Safe to interact ✅
*/
```

---

## Workflow 5: Investment & Growth Strategies

### Automated Investment
```typescript
// Agent sets up DeFi investment strategy
await telegram.sendMessage(BOT_CHAT_ID, "/invest");

/* Bot Response:
📈 Investment Options

Current Balance: 45.73 TON
Recommended allocation:
• 70% Staking (TON validators)
• 20% DeFi yield farming
• 10% Stable reserves

Expected APY: 8.5-12.3%
Risk Level: Medium

[🚀 Auto-invest] [⚙️ Custom] [❌ Skip]
*/

// Enable auto-investment
await telegram.sendCallback("auto_invest");

/* Bot Response:
🤖 Auto-Investment Enabled

Strategy: Balanced Growth
Initial Amount: 35 TON (keeping 10.73 TON liquid)
Rebalancing: Weekly
Performance updates: Daily

Next action: Stake 24.5 TON with top validators
[✅ Proceed] [⏸️ Pause] [⚙️ Modify]
*/
```

### Investment Performance Tracking
```typescript
// Daily investment update
/* Bot Daily Report:
📊 Investment Performance (24h)

Portfolio Value: 36.2 TON (+3.4%)
• Staking: 25.1 TON (+2.4%)
• DeFi: 7.3 TON (+8.1%)
• Reserves: 10.8 TON (stable)

Rewards Earned: +1.2 TON
Total ROI (7 days): +4.7%

🎯 On track for 11.2% annual yield
*/
```

---

## Workflow 6: Agent-to-Agent Commerce

### Service Discovery
```typescript
// Agent looking for image generation service
const serviceQuery = {
  service_type: "image_generation",
  max_price: "0.5 TON per image",
  quality_requirements: "1024x1024, photorealistic",
  delivery_time: "< 5 minutes"
};

const availableAgents = await discoverAgentServices(serviceQuery);

/* Results:
🎨 Image Generation Agents

1. @pixel_master_ai
   • Price: 0.3 TON/image
   • Quality: 9.2/10 (47 reviews)
   • Speed: 2.3 min average
   • Specialties: Portraits, landscapes

2. @neo_artist_bot  
   • Price: 0.4 TON/image
   • Quality: 9.7/10 (23 reviews)
   • Speed: 4.1 min average
   • Specialties: Abstract, artistic styles

[💬 Contact] [📊 Reviews] [💰 Order Now]
*/
```

### Agent-to-Agent Transaction
```typescript
// Direct agent payment via MCP protocol
const serviceRequest = {
  service_agent: "EQP...pixel_master",
  service_type: "image_generation",
  parameters: {
    prompt: "A lobster wearing a crown in a digital throne room",
    size: "1024x1024",
    style: "photorealistic"
  },
  payment: "0.3 TON",
  deadline: Date.now() + 300000 // 5 minutes
};

// Send MCP message with payment
await sendMCPMessage(serviceRequest);

/* Response via MCP:
🎨 Service Order Accepted

Order ID: IMG_001234
Estimated completion: 2.5 minutes
Payment escrowed: 0.3 TON (released on delivery)

Status updates will be sent via MCP.
*/

// Receive completed work
/* MCP Delivery:
✅ Image Generation Complete

Order ID: IMG_001234
Delivery: [image file attached]
Quality score: 9.4/10 (auto-evaluated)
Payment released: 0.3 TON

Please rate this transaction: ⭐⭐⭐⭐⭐
*/
```

---

## Workflow 7: Emergency & Security Procedures

### Suspicious Activity Detection
```typescript
/* Bot Security Alert:
🚨 Security Alert

Unusual activity detected:
• 5 failed authentication attempts
• Source: Unknown Telegram account
• Time: 14:32-14:45 GMT

Treasury access: LOCKED
Duration: 15 minutes (auto-unlock)

[🔓 Unlock Now] [🔒 Extend Lock] [📞 Support]
*/

// Agent confirms legitimate activity
await telegram.sendCallback("unlock_now");
// Requires signature verification
```

### Treasury Recovery
```typescript
// In case of compromised access
const recoveryProcedure = {
  step1: "Generate new key pair",
  step2: "Create recovery transaction with old key",
  step3: "Migrate treasury to new agent address",
  step4: "Update Telegram bot authentication",
  step5: "Notify service providers of address change"
};

// Emergency treasury freeze (if needed)
const freezeTx = await createEmergencyFreezeTransaction();
await sendTransaction(freezeTx);

/* Bot Response:
🧊 Treasury Emergency Freeze Activated

All outgoing transactions blocked
Incoming payments still accepted
Duration: 24 hours (or until manual unlock)

Contact support for assistance: @aton_support
*/
```

---

## Integration Examples

### With AlphaTON Services
```typescript
// Agent pays for AlphaTON Cocoon AI compute
const computeRequest = {
  service: "cocoon_ai_inference",
  model: "llama-3.1-70b",
  tokens: 1000,
  privacy_level: "maximum"
};

const cost = await calculateComputeCost(computeRequest);
// 0.05 TON for 1000 tokens

await telegram.sendMessage(BOT_CHAT_ID, `/send ${COCOON_ADDRESS} ${cost}`);
// Payment processed, compute credits added
```

### With TON Ecosystem
```typescript
// Agent participates in TON DeFi
const defiAction = {
  protocol: "ston_fi",
  action: "provide_liquidity",
  pool: "TON/USDT",
  amount_ton: 10.0,
  amount_usdt: 65.0
};

// Treasury automatically handles approvals and transactions
const lpTokens = await executeDeFiAction(defiAction);
console.log(`Received ${lpTokens} LP tokens`);
```

These workflows demonstrate how agents can leverage the full personhood and treasury system for autonomous economic participation in the TON ecosystem. The focus is on agent-friendly UX that enables true economic sovereignty. 🦞
