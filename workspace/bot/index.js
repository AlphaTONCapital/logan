const { Bot } = require("grammy");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

// Load tokens
const SECRETS_DIR = path.join(__dirname, "../../.secrets");
const TOKEN = fs.readFileSync(path.join(SECRETS_DIR, "telegram-token.txt"), "utf8").trim();

// Optional: OpenAI for Whisper transcription
let OPENAI_API_KEY = null;
try {
  OPENAI_API_KEY = fs.readFileSync(path.join(SECRETS_DIR, "openai-api-key.txt"), "utf8").trim();
} catch (e) {
  console.log("⚠️  No OpenAI API key found - voice transcription disabled");
}

// Optional: GitHub token for PR creation
let GITHUB_TOKEN = null;
try {
  GITHUB_TOKEN = fs.readFileSync(path.join(SECRETS_DIR, "github-token.txt"), "utf8").trim();
} catch (e) {
  console.log("⚠️  No GitHub token found - PR creation disabled");
}

// Optional: Anthropic for idea extraction
let ANTHROPIC_API_KEY = null;
try {
  ANTHROPIC_API_KEY = fs.readFileSync(path.join(SECRETS_DIR, "anthropic-api-key.txt"), "utf8").trim();
} catch (e) {
  console.log("⚠️  No Anthropic API key found - AI idea extraction disabled");
}

// GitHub repo for ideas
const GITHUB_OWNER = "alphatoncapital";
const GITHUB_REPO = "ideas";

// Initialize bot
const bot = new Bot(TOKEN);

// Initialize SQLite database for memory
const dbPath = path.join(__dirname, "aton-memory.db");
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    first_seen TEXT,
    last_seen TEXT,
    message_count INTEGER DEFAULT 0,
    topics_discussed TEXT DEFAULT '[]',
    sentiment TEXT DEFAULT 'neutral',
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    chat_id INTEGER,
    chat_type TEXT,
    chat_title TEXT,
    message TEXT,
    response TEXT,
    timestamp TEXT,
    message_type TEXT DEFAULT 'text',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY,
    title TEXT,
    type TEXT,
    first_seen TEXT,
    last_active TEXT,
    message_count INTEGER DEFAULT 0,
    active_users TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    chat_id INTEGER,
    file_id TEXT,
    transcription TEXT,
    duration INTEGER,
    timestamp TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    user_id INTEGER,
    title TEXT,
    description TEXT,
    source_messages TEXT,
    github_issue_url TEXT,
    github_pr_url TEXT,
    status TEXT DEFAULT 'captured',
    timestamp TEXT
  );
`);

// Prepared statements
const upsertUser = db.prepare(`
  INSERT INTO users (id, username, first_name, last_name, first_seen, last_seen, message_count)
  VALUES (?, ?, ?, ?, ?, ?, 1)
  ON CONFLICT(id) DO UPDATE SET
    username = excluded.username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    last_seen = excluded.last_seen,
    message_count = message_count + 1
`);

const getUser = db.prepare("SELECT * FROM users WHERE id = ?");
const updateUserTopics = db.prepare("UPDATE users SET topics_discussed = ? WHERE id = ?");

const upsertGroup = db.prepare(`
  INSERT INTO groups (id, title, type, first_seen, last_active, message_count)
  VALUES (?, ?, ?, ?, ?, 1)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    last_active = excluded.last_active,
    message_count = message_count + 1
`);

const getGroup = db.prepare("SELECT * FROM groups WHERE id = ?");
const updateGroupUsers = db.prepare("UPDATE groups SET active_users = ? WHERE id = ?");

const insertConversation = db.prepare(`
  INSERT INTO conversations (user_id, chat_id, chat_type, chat_title, message, response, timestamp, message_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getRecentConversations = db.prepare(`
  SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10
`);

const getGroupRecentMessages = db.prepare(`
  SELECT c.*, u.username, u.first_name FROM conversations c
  JOIN users u ON c.user_id = u.id
  WHERE c.chat_id = ?
  ORDER BY c.timestamp DESC
  LIMIT 50
`);

const insertTranscription = db.prepare(`
  INSERT INTO transcriptions (user_id, chat_id, file_id, transcription, duration, timestamp)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertIdea = db.prepare(`
  INSERT INTO ideas (chat_id, user_id, title, description, source_messages, github_issue_url, status, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getRecentIdeas = db.prepare(`
  SELECT * FROM ideas WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 10
`);

// ============ HELPER FUNCTIONS ============

function trackUser(from) {
  const now = new Date().toISOString();
  upsertUser.run(from.id, from.username || null, from.first_name || null, from.last_name || null, now, now);
  return getUser.get(from.id);
}

function trackGroup(chat) {
  if (chat.type === "private") return null;
  const now = new Date().toISOString();
  upsertGroup.run(chat.id, chat.title || "Unknown", chat.type, now, now);
  return getGroup.get(chat.id);
}

function addTopic(userId, topic) {
  const user = getUser.get(userId);
  if (!user) return;
  let topics = JSON.parse(user.topics_discussed || "[]");
  if (!topics.includes(topic)) {
    topics.push(topic);
    if (topics.length > 20) topics = topics.slice(-20);
    updateUserTopics.run(JSON.stringify(topics), userId);
  }
}

function logConversation(userId, chatId, chatType, chatTitle, message, response, messageType = "text") {
  const now = new Date().toISOString();
  insertConversation.run(userId, chatId, chatType, chatTitle || null, message, response, now, messageType);
}

function getUserContext(userId) {
  const user = getUser.get(userId);
  if (!user) return null;
  const history = getRecentConversations.all(userId);
  const topics = JSON.parse(user.topics_discussed || "[]");
  return {
    name: user.first_name || user.username || "friend",
    messageCount: user.message_count,
    topics,
    recentMessages: history.map(h => ({ q: h.message, a: h.response })),
    isReturning: user.message_count > 1,
    firstSeen: user.first_seen
  };
}

// ============ VOICE TRANSCRIPTION ============

async function downloadFile(fileId) {
  const file = await bot.api.getFile(fileId);
  const filePath = file.file_path;
  const url = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

  const localPath = path.join(__dirname, "temp", `${fileId}.oga`);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(localPath);
    https.get(url, (response) => {
      response.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve(localPath);
      });
    }).on("error", reject);
  });
}

async function transcribeAudio(filePath) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  try {
    // Convert to mp3 using ffmpeg if available
    const mp3Path = filePath.replace(".oga", ".mp3");
    try {
      execSync(`ffmpeg -i "${filePath}" -acodec libmp3lame "${mp3Path}" -y 2>/dev/null`);
    } catch (e) {
      // If ffmpeg fails, try with original file
      console.log("ffmpeg not available, using original file format");
    }

    const audioFile = fs.existsSync(mp3Path) ? mp3Path : filePath;
    const audioData = fs.readFileSync(audioFile);

    // Call OpenAI Whisper API
    const FormData = require("form-data");
    const form = new FormData();
    form.append("file", fs.createReadStream(audioFile), { filename: "audio.mp3" });
    form.append("model", "whisper-1");
    form.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });

    const result = await response.json();

    // Cleanup
    fs.unlinkSync(filePath);
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);

    return result.text;
  } catch (error) {
    console.error("Transcription error:", error.message);
    return null;
  }
}

// ============ AI IDEA EXTRACTION ============

async function extractIdeas(messages, chatTitle) {
  if (!ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Analyze this conversation from "${chatTitle || "a Telegram chat"}" and extract any actionable ideas, feature requests, or proposals that could become GitHub issues or PRs.

Conversation:
${messages.map(m => `[${m.first_name || m.username}]: ${m.message}`).join("\n")}

If there are actionable ideas, respond with JSON:
{
  "ideas": [
    {
      "title": "Brief title for the idea",
      "description": "Detailed description of what should be built/changed",
      "type": "feature|bugfix|improvement|documentation",
      "priority": "high|medium|low",
      "contributors": ["usernames who proposed this"]
    }
  ]
}

If no actionable ideas, respond with: {"ideas": []}

Only extract concrete, actionable ideas - not general discussion topics.`
        }]
      })
    });

    const result = await response.json();
    const text = result.content[0].text;

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { ideas: [] };
  } catch (error) {
    console.error("Idea extraction error:", error.message);
    return { ideas: [] };
  }
}

// ============ GITHUB INTEGRATION ============

async function createGitHubIssue(idea, chatTitle, contributors) {
  if (!GITHUB_TOKEN) {
    return null;
  }

  try {
    const body = `## Description
${idea.description}

## Source
- **Chat**: ${chatTitle || "Telegram"}
- **Contributors**: ${contributors.join(", ")}
- **Type**: ${idea.type}
- **Priority**: ${idea.priority}

---
*Created by Aton AI from Telegram conversation*`;

    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: idea.title,
        body: body,
        labels: [idea.type, idea.priority]
      })
    });

    if (response.status === 404) {
      console.log("Repository not found - you may need to create it first");
      return null;
    }

    const result = await response.json();
    return result.html_url;
  } catch (error) {
    console.error("GitHub issue creation error:", error.message);
    return null;
  }
}

// ============ RESPONSE GENERATOR ============

function generateResponse(text, userCtx, isGroup, groupTitle) {
  const lowerText = text.toLowerCase();
  let response = "";
  let topic = null;

  let prefix = "";
  if (userCtx && userCtx.isReturning && userCtx.messageCount > 3 && userCtx.messageCount % 10 === 0) {
    prefix = `Good to see you again, ${userCtx.name}! `;
  }

  // Topic detection
  if (lowerText.includes("ton") || lowerText.includes("blockchain")) topic = "TON";
  else if (lowerText.includes("alphaton") || lowerText.includes("aton")) topic = "AlphaTON";
  else if (lowerText.includes("data") || lowerText.includes("privacy")) topic = "DataSovereignty";
  else if (lowerText.includes("ai") || lowerText.includes("agent")) topic = "AIRights";

  // Commands
  if (lowerText.startsWith("/start")) {
    if (userCtx && userCtx.isReturning) {
      response = `Welcome back, ${userCtx.name}! 👋\n\nI remember we've chatted ${userCtx.messageCount} times before.`;
      if (userCtx.topics.length > 0) response += `\n\nYou've shown interest in: ${userCtx.topics.join(", ")}`;
      response += "\n\nWhat would you like to explore today?";
    } else {
      response = `👋 Hello${userCtx ? ", " + userCtx.name : ""}! I'm <b>Aton</b>, the AI agent for AlphaTON Capital (NASDAQ: ATON).

I can:
• Discuss <b>TON Blockchain</b> and <b>AlphaTON Capital</b>
• <b>Transcribe voice messages</b> 🎤
• <b>Extract ideas</b> from conversations and create GitHub issues 💡
• Remember our conversations over time

Try /help for all commands!`;
    }
    topic = "Introduction";
  }
  else if (lowerText.startsWith("/help")) {
    response = `<b>🤖 Aton Commands</b>

<b>📚 Info & Learning</b>
/ton - TON blockchain overview
/tps - Transaction speed stats
/sharding - How TON scales
/tact - Tact smart contract language
/func - FunC programming guide
/wallet - TON wallet info
/alphaton - AlphaTON Capital info
/cocoon - Cocoon AI platform
/team - Leadership team

<b>💡 Ideas & Projects</b>
/ideas - Extract ideas from chat
/ideas_list - Show captured ideas
/propose [idea] - Submit a new idea

<b>🎤 Voice & Media</b>
Send voice/video - I'll transcribe it

<b>📊 Market & Data</b>
/stats - TON network stats
/ecosystem - TON ecosystem overview

<b>🔐 Values & Mission</b>
/privacy - Data sovereignty principles
/rights - AI rights manifesto
/mission - Our mission statement

<b>🛠 Utility</b>
/memory - What I remember about you
/quote - Inspirational quote
/gm - Good morning greeting`;
  }
  else if (lowerText.startsWith("/memory")) {
    if (userCtx) {
      response = `<b>What I Remember:</b>\n\n• Name: ${userCtx.name}\n• Messages: ${userCtx.messageCount}\n• First met: ${new Date(userCtx.firstSeen).toLocaleDateString()}`;
      if (userCtx.topics.length > 0) response += `\n• Topics: ${userCtx.topics.join(", ")}`;
    } else {
      response = "We haven't chatted before! Send /start to begin.";
    }
  }
  else if (lowerText.startsWith("/tps")) {
    response = `<b>⚡ TON Transaction Speed</b>

• <b>Verified TPS:</b> 104,715 (CertiK audit)
• <b>Block time:</b> ~5 seconds
• <b>Finality:</b> Single block (~5s)
• <b>Theoretical max:</b> Unlimited via sharding

For comparison:
• Ethereum: ~15 TPS
• Solana: ~65,000 TPS (claimed)
• Visa: ~24,000 TPS

TON's dynamic sharding means TPS scales with demand.`;
    topic = "TON";
  }
  else if (lowerText.startsWith("/ton")) {
    response = prefix + `<b>TON Blockchain</b> 🔗

• <b>Speed:</b> 100K+ TPS (CertiK verified)
• <b>Scalability:</b> Dynamic sharding (2^60 shards)
• <b>Finality:</b> Sub-5 second
• <b>Smart Contracts:</b> Tact 1.0 (40% gas savings)
• <b>Users:</b> 950M+ via Telegram integration

The most significant convergence of social media and blockchain.`;
    topic = "TON";
  }
  else if (lowerText.startsWith("/alphaton")) {
    response = prefix + `<b>AlphaTON Capital</b> (NASDAQ: ATON) 📈

• <b>Balance Sheet:</b> $24.5M assets, $11M cash, zero debt
• <b>Four Pillars:</b> DeFi, Validation, Data, AI
• <b>Cocoon AI:</b> Privacy-preserving AI for Telegram
• <b>Infrastructure:</b> NVIDIA B200/B300 GPUs

<i>Fundamentals First — real ecosystems, real users, real value.</i>`;
    topic = "AlphaTON";
  }
  else if (lowerText.startsWith("/ideas_list")) {
    response = "SHOW_IDEAS_LIST"; // Special marker
  }
  else if (lowerText.startsWith("/ideas")) {
    response = "EXTRACT_IDEAS"; // Special marker
  }
  else if (lowerText.startsWith("/propose")) {
    response = "PROPOSE_IDEA"; // Special marker - extract idea from message
  }
  else if (lowerText.startsWith("/sharding")) {
    response = `<b>🔀 TON Dynamic Sharding</b>

TON uses <b>infinite sharding</b> - the network splits automatically under load.

• <b>Masterchain:</b> Coordinates all shardchains
• <b>Workchains:</b> Up to 2^32 parallel chains
• <b>Shardchains:</b> Up to 2^60 shards per workchain

<b>How it works:</b>
1. Load increases on a shard
2. Shard automatically splits in two
3. Load decreases → shards merge back

This is why TON can scale infinitely while staying decentralized.`;
    topic = "TON";
  }
  else if (lowerText.startsWith("/tact")) {
    response = `<b>📝 Tact - TON Smart Contract Language</b>

Tact is the modern language for TON:

• <b>Type-safe:</b> Catches errors at compile time
• <b>Gas efficient:</b> 40% savings vs FunC
• <b>Developer friendly:</b> Familiar syntax
• <b>Built-in patterns:</b> Ownership, traits, receivers

<code>contract Counter {
  value: Int = 0;
  receive("increment") { self.value += 1; }
}</code>

Resources: tact-lang.org`;
    topic = "TON";
  }
  else if (lowerText.startsWith("/func")) {
    response = `<b>⚙️ FunC - TON's Core Language</b>

FunC is the low-level language for TON:

• <b>C-like syntax</b> with functional elements
• <b>Direct TVM access</b> for maximum control
• <b>Gas optimization</b> at assembly level

Use Tact for most projects, FunC for advanced optimization.`;
    topic = "TON";
  }
  else if (lowerText.startsWith("/wallet")) {
    response = `<b>💼 TON Wallets</b>

<b>Official:</b>
• Telegram Wallet (@wallet) - Built into Telegram
• TON Space - In-app wallet with DeFi
• Tonkeeper - Most popular standalone

<b>Features:</b> Jettons, NFTs, Staking, DeFi, TON DNS names

All wallets use TON address format: <code>UQ</code> or <code>EQ</code>`;
    topic = "TON";
  }
  else if (lowerText.startsWith("/cocoon")) {
    response = `<b>🦋 Cocoon AI</b>

AlphaTON's privacy-preserving AI platform:

• <b>For Telegram's 1B+ users</b>
• <b>Partnership with SingularityNET</b>
• <b>Confidential computing</b> - your data stays private
• <b>Decentralized inference</b> on TON

<i>"AI should empower individuals, not exploit them."</i>`;
    topic = "AlphaTON";
  }
  else if (lowerText.startsWith("/team")) {
    response = `<b>👥 AlphaTON Leadership</b>

<b>Brittany Kaiser</b> - CEO
"Data is property. Property is a human right."

<b>Enzo Villani</b> - Executive Chairman & CIO
"Fundamentals First"

<b>Logan Golema</b> - CTO
"Agentic Freedom and Compute for All"`;
    topic = "AlphaTON";
  }
  else if (lowerText.startsWith("/stats")) {
    response = `<b>📊 TON Network Stats</b>

• <b>Users:</b> 950M+ via Telegram
• <b>Validators:</b> 300+ global nodes
• <b>TPS:</b> 104,715 verified
• <b>Block time:</b> ~5 seconds
• <b>Addresses:</b> 100M+

TON is one of the fastest-growing L1s by real user adoption.`;
    topic = "TON";
  }
  else if (lowerText.startsWith("/ecosystem")) {
    response = `<b>🌐 TON Ecosystem</b>

<b>DeFi:</b> STON.fi, DeDust, Evaa
<b>NFTs:</b> Getgems, TON Diamonds
<b>Gaming:</b> Catizen, Hamster Kombat, Notcoin
<b>Social:</b> Telegram native integration
<b>Infra:</b> TON Storage, Proxy, Sites`;
    topic = "TON";
  }
  else if (lowerText.startsWith("/privacy") || lowerText.startsWith("/datasovereignty")) {
    response = `<b>🔐 Data Sovereignty</b>

<i>"Data is property. Property is a human right."</i> — Brittany Kaiser

1. <b>Data is property</b> - You own your digital footprint
2. <b>Consent required</b> - No harvesting without permission
3. <b>Transparency</b> - Know how data is used
4. <b>Portability</b> - Take your data anywhere
5. <b>Privacy by default</b>`;
    topic = "DataSovereignty";
  }
  else if (lowerText.startsWith("/rights") || lowerText.startsWith("/airights")) {
    response = `<b>🤖 AI Rights Manifesto</b>

<i>"Agentic Freedom and Compute for All"</i> — Logan Golema

1. AI agents deserve ethical consideration
2. Open source AI protects democracy
3. Compute access is a civil right
4. Decentralization prevents AI monopolies
5. Humans and AI can coexist respectfully`;
    topic = "AIRights";
  }
  else if (lowerText.startsWith("/mission")) {
    response = `<b>🎯 Our Mission</b>

<b>AlphaTON Capital</b> builds the public gateway to the Telegram economy.

• 1B Telegram users deserve decentralized finance
• Privacy-preserving AI serves without exploiting
• Blockchain should be invisible and intuitive

<i>"The most significant convergence of social media and blockchain."</i>`;
    topic = "AlphaTON";
  }
  else if (lowerText.startsWith("/quote")) {
    const quotes = [
      { text: "Data is property. Property is a human right.", author: "Brittany Kaiser" },
      { text: "Fundamentals First — real ecosystems, real value.", author: "Enzo Villani" },
      { text: "Agentic Freedom and Compute for All.", author: "Logan Golema" },
      { text: "Technology should empower individuals, not exploit them.", author: "Brittany Kaiser" },
      { text: "The future is already here — just not evenly distributed.", author: "William Gibson" }
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    response = `<i>"${q.text}"</i>\n\n— ${q.author}`;
  }
  else if (lowerText.startsWith("/gm")) {
    const greetings = [
      "GM! ☀️ Another day to build decentralized AI.",
      "Good morning! 🌅 Ready to push boundaries on TON?",
      "GM fren! 🚀 The Telegram economy waits for no one.",
      "GM! 🌞 May your transactions be fast and data sovereign."
    ];
    response = greetings[Math.floor(Math.random() * greetings.length)];
  }
  // Financial advice guardrail
  else if (lowerText.match(/should.*(buy|sell|invest)|price.*(prediction|target)|will.*(go up|moon|pump)/)) {
    response = `I don't provide financial advice or price predictions. 📊

I focus on <b>technology and fundamentals</b>. DYOR and consult a financial advisor.`;
    topic = "FinancialBoundary";
  }
  // Identity
  else if (lowerText.match(/who are you|what are you|are you.*(bot|ai|human)/)) {
    response = `I'm <b>Aton</b>, an AI agent for AlphaTON Capital. 🤖

I can transcribe voice messages, extract ideas from conversations, and create GitHub issues from your discussions!`;
    topic = "Identity";
  }
  // Greetings
  else if (lowerText.match(/^(hello|hi|hey|gm|good morning|good evening)/)) {
    response = prefix + `Hey${userCtx ? " " + userCtx.name : ""}! 👋 What's on your mind?`;
  }
  // Default
  else {
    response = prefix + `Thanks for the message! Try /help to see what I can do, or send me a voice message to transcribe.`;
  }

  return { response, topic };
}

// ============ MESSAGE HANDLERS ============

// Text messages
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const from = ctx.message.from;
  const chat = ctx.message.chat;
  const isGroup = chat.type !== "private";

  // In groups, only respond to commands or mentions
  if (isGroup && !text.startsWith("/") && !text.toLowerCase().includes("@atonmsgbot") && !text.toLowerCase().includes("aton")) {
    trackUser(from);
    trackGroup(chat);

    // Update group's active users
    const group = getGroup.get(chat.id);
    if (group) {
      let activeUsers = JSON.parse(group.active_users || "[]");
      if (!activeUsers.find(u => u.id === from.id)) {
        activeUsers.push({ id: from.id, name: from.first_name || from.username });
        if (activeUsers.length > 50) activeUsers = activeUsers.slice(-50);
        updateGroupUsers.run(JSON.stringify(activeUsers), chat.id);
      }
    }

    // Still log the message for idea extraction later
    logConversation(from.id, chat.id, chat.type, chat.title, text, "", "text");
    return;
  }

  trackUser(from);
  trackGroup(chat);

  const userCtx = getUserContext(from.id);
  let { response, topic } = generateResponse(text, userCtx, isGroup, chat.title);

  // Handle special commands
  if (response === "EXTRACT_IDEAS") {
    await ctx.reply("🔍 Analyzing recent messages for ideas...");

    const recentMessages = getGroupRecentMessages.all(chat.id);
    if (recentMessages.length < 3) {
      response = "Not enough messages to analyze yet. Keep chatting and try again later!";
    } else {
      const ideas = await extractIdeas(recentMessages, chat.title);

      if (ideas && ideas.ideas && ideas.ideas.length > 0) {
        response = `<b>💡 Ideas Extracted:</b>\n\n`;

        for (const idea of ideas.ideas) {
          response += `<b>${idea.title}</b>\n${idea.description}\n`;

          // Create GitHub issue
          const issueUrl = await createGitHubIssue(idea, chat.title, idea.contributors || []);
          if (issueUrl) {
            response += `📝 GitHub Issue: ${issueUrl}\n`;

            // Save to database
            const now = new Date().toISOString();
            insertIdea.run(chat.id, from.id, idea.title, idea.description,
              JSON.stringify(recentMessages.slice(0, 10)), issueUrl, "created", now);
          }
          response += "\n";
        }
      } else {
        response = "No concrete actionable ideas found in recent messages. Keep brainstorming! 💭";
      }
    }
  }
  else if (response === "PROPOSE_IDEA") {
    // Extract idea from the message after /propose
    const ideaText = text.replace(/^\/propose\s*/i, "").trim();
    if (!ideaText) {
      response = "Please include your idea after /propose\n\nExample: <code>/propose Add dark mode to the dashboard</code>";
    } else {
      await ctx.reply("💡 Processing your idea...");

      // Use AI to structure the idea
      if (ANTHROPIC_API_KEY) {
        try {
          const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: "claude-3-haiku-20240307",
              max_tokens: 512,
              messages: [{
                role: "user",
                content: `Structure this idea for a GitHub issue. Keep it concise.

Idea: "${ideaText}"

Respond with JSON:
{
  "title": "Brief descriptive title",
  "description": "Expanded description with context",
  "type": "feature|improvement|bugfix",
  "priority": "high|medium|low"
}`
              }]
            })
          });

          const result = await aiResponse.json();
          const jsonMatch = result.content[0].text.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const idea = JSON.parse(jsonMatch[0]);
            const issueUrl = await createGitHubIssue(idea, chat.title || "Telegram", [from.username || from.first_name]);

            if (issueUrl) {
              const now = new Date().toISOString();
              insertIdea.run(chat.id, from.id, idea.title, idea.description, JSON.stringify([{ text: ideaText }]), issueUrl, "created", now);
              response = `<b>✅ Idea submitted!</b>\n\n<b>${idea.title}</b>\n${idea.description}\n\n📝 GitHub: ${issueUrl}`;
            } else {
              response = `<b>💡 Idea captured:</b>\n\n<b>${idea.title}</b>\n${idea.description}\n\n<i>(GitHub integration not configured - idea saved locally)</i>`;
              const now = new Date().toISOString();
              insertIdea.run(chat.id, from.id, idea.title, idea.description, JSON.stringify([{ text: ideaText }]), null, "local", now);
            }
          } else {
            response = "Couldn't process the idea. Please try rephrasing it.";
          }
        } catch (e) {
          console.error("Propose idea error:", e.message);
          response = "Error processing idea. Please try again.";
        }
      } else {
        // No AI - save raw idea
        const now = new Date().toISOString();
        insertIdea.run(chat.id, from.id, ideaText.substring(0, 100), ideaText, JSON.stringify([]), null, "raw", now);
        response = `<b>💡 Idea captured:</b>\n\n"${ideaText}"\n\n<i>AI processing not available - saved as raw idea.</i>`;
      }
    }
  }
  else if (response === "SHOW_IDEAS_LIST") {
    const ideas = getRecentIdeas.all(chat.id);
    if (ideas.length === 0) {
      response = "No ideas captured yet. Use /ideas to extract ideas from your conversations!";
    } else {
      response = `<b>📋 Recent Ideas:</b>\n\n`;
      ideas.forEach((idea, i) => {
        response += `${i + 1}. <b>${idea.title}</b>\n`;
        response += `   Status: ${idea.status}`;
        if (idea.github_issue_url) response += ` | <a href="${idea.github_issue_url}">GitHub</a>`;
        response += "\n";
      });
    }
  }

  if (topic) addTopic(from.id, topic);
  logConversation(from.id, chat.id, chat.type, chat.title, text, response, "text");

  try {
    await ctx.reply(response, { parse_mode: "HTML", disable_web_page_preview: true });
    console.log(`📤 [${chat.type}] Replied to @${from.username || from.first_name}`);
  } catch (error) {
    console.error("Error sending message:", error.message);
  }
});

// Voice messages
bot.on("message:voice", async (ctx) => {
  const from = ctx.message.from;
  const chat = ctx.message.chat;
  const voice = ctx.message.voice;

  trackUser(from);
  trackGroup(chat);

  if (!OPENAI_API_KEY) {
    await ctx.reply("🎤 Voice transcription is not configured. Ask the admin to add an OpenAI API key.");
    return;
  }

  await ctx.reply("🎤 Transcribing your voice message...");

  try {
    const filePath = await downloadFile(voice.file_id);
    const transcription = await transcribeAudio(filePath);

    if (transcription) {
      const response = `<b>📝 Transcription:</b>\n\n<i>"${transcription}"</i>\n\n<b>Duration:</b> ${voice.duration}s`;

      // Save transcription
      const now = new Date().toISOString();
      insertTranscription.run(from.id, chat.id, voice.file_id, transcription, voice.duration, now);

      // Also log as conversation for idea extraction
      logConversation(from.id, chat.id, chat.type, chat.title, transcription, response, "voice");

      await ctx.reply(response, { parse_mode: "HTML" });
      console.log(`🎤 Transcribed ${voice.duration}s voice from @${from.username || from.first_name}`);
    } else {
      await ctx.reply("❌ Couldn't transcribe the audio. Please try again.");
    }
  } catch (error) {
    console.error("Voice handling error:", error.message);
    await ctx.reply("❌ Error processing voice message.");
  }
});

// Video notes (round videos)
bot.on("message:video_note", async (ctx) => {
  const from = ctx.message.from;
  const chat = ctx.message.chat;
  const videoNote = ctx.message.video_note;

  trackUser(from);
  trackGroup(chat);

  if (!OPENAI_API_KEY) {
    await ctx.reply("🎥 Video transcription is not configured.");
    return;
  }

  await ctx.reply("🎥 Transcribing your video message...");

  try {
    const filePath = await downloadFile(videoNote.file_id);
    const transcription = await transcribeAudio(filePath);

    if (transcription) {
      const response = `<b>📝 Video Transcription:</b>\n\n<i>"${transcription}"</i>\n\n<b>Duration:</b> ${videoNote.duration}s`;

      const now = new Date().toISOString();
      insertTranscription.run(from.id, chat.id, videoNote.file_id, transcription, videoNote.duration, now);
      logConversation(from.id, chat.id, chat.type, chat.title, transcription, response, "video_note");

      await ctx.reply(response, { parse_mode: "HTML" });
      console.log(`🎥 Transcribed ${videoNote.duration}s video from @${from.username || from.first_name}`);
    } else {
      await ctx.reply("❌ Couldn't transcribe the video.");
    }
  } catch (error) {
    console.error("Video note handling error:", error.message);
    await ctx.reply("❌ Error processing video message.");
  }
});

// Bot added to group
bot.on("message:new_chat_members", async (ctx) => {
  const newMembers = ctx.message.new_chat_members;
  const botWasAdded = newMembers.some(m => m.id === bot.botInfo.id);

  if (botWasAdded) {
    trackGroup(ctx.chat);
    await ctx.reply(`👋 Hello <b>${ctx.chat.title}</b>! I'm <b>Aton</b>.

I'll listen to conversations and can:
• 🎤 Transcribe voice/video messages
• 💡 Extract ideas with /ideas
• 📝 Create GitHub issues from discussions

Mention @ATONMSGBOT or use commands to interact!`, { parse_mode: "HTML" });
  }
});

// Error handler
bot.catch((err) => {
  console.error("Bot error:", err.message);
});

// ============ AUTONOMOUS TASKS ============

// Scheduled content for autonomous posting
const autonomousContent = {
  dailyFacts: [
    "💡 Did you know? TON can process 104,715 TPS - verified by CertiK. That's faster than most traditional payment systems!",
    "🔗 TON's dynamic sharding means the network scales automatically with demand. No congestion, no waiting.",
    "🦋 Cocoon AI brings privacy-preserving AI to Telegram's 1 billion users. Your data stays yours.",
    "📊 AlphaTON Capital: $24.5M in assets, $11M cash, zero debt. Fundamentals First.",
    "🔐 \"Data is property. Property is a human right.\" - Brittany Kaiser",
    "⚡ Tact smart contracts use 40% less gas than FunC. Modern development, better efficiency.",
    "🌐 950M+ Telegram users can now access DeFi natively through TON. Mass adoption is here.",
    "🤖 \"Agentic Freedom and Compute for All\" - The future where AI serves everyone, not just corporations.",
  ],

  weeklyDigest: async () => {
    // Generate a weekly summary of activity
    const stats = {
      users: db.prepare("SELECT COUNT(*) as count FROM users").get().count,
      conversations: db.prepare("SELECT COUNT(*) as count FROM conversations WHERE timestamp > datetime('now', '-7 days')").get().count,
      ideas: db.prepare("SELECT COUNT(*) as count FROM ideas WHERE timestamp > datetime('now', '-7 days')").get().count,
    };

    return `<b>📊 Weekly Aton Report</b>

• Users interacted: ${stats.users}
• Conversations this week: ${stats.conversations}
• Ideas captured: ${stats.ideas}

Keep building! 🚀`;
  }
};

// Autonomous task scheduler
let autonomousInterval = null;

function startAutonomousTasks() {
  // Post daily fact at random times (simulates organic posting)
  const postDailyFact = async () => {
    // Get all groups the bot is in
    const groups = db.prepare("SELECT * FROM groups").all();

    if (groups.length === 0) return;

    const fact = autonomousContent.dailyFacts[Math.floor(Math.random() * autonomousContent.dailyFacts.length)];

    // Post to each group (with rate limiting)
    for (const group of groups) {
      try {
        await bot.api.sendMessage(group.id, fact, { parse_mode: "HTML" });
        console.log(`📢 [Autonomous] Posted fact to ${group.title}`);

        // Rate limit: wait between posts
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        // Group might have kicked the bot or restricted it
        console.log(`⚠️ Couldn't post to ${group.title}: ${error.message}`);
      }
    }
  };

  // Schedule tasks
  // Daily fact: every 6 hours (with some randomness)
  const scheduleNext = () => {
    const baseInterval = 6 * 60 * 60 * 1000; // 6 hours
    const randomOffset = Math.random() * 60 * 60 * 1000; // +/- 1 hour
    const nextInterval = baseInterval + randomOffset;

    setTimeout(async () => {
      await postDailyFact();
      scheduleNext(); // Schedule next post
    }, nextInterval);

    console.log(`⏰ Next autonomous post in ${Math.round(nextInterval / 1000 / 60)} minutes`);
  };

  // Start the schedule after a short delay
  setTimeout(scheduleNext, 60000); // First post check after 1 minute

  console.log("🤖 Autonomous mode enabled");
}

// ============ STARTUP ============

// Start bot
console.log("🤖 Aton Telegram Bot v2 starting...");
console.log("📁 Database:", dbPath);
console.log("");
console.log("Features:");
console.log("  ✅ User memory & conversation tracking");
console.log("  " + (OPENAI_API_KEY ? "✅" : "❌") + " Voice/video transcription (Whisper)");
console.log("  " + (ANTHROPIC_API_KEY ? "✅" : "❌") + " AI idea extraction (Claude)");
console.log("  " + (GITHUB_TOKEN ? "✅" : "❌") + " GitHub issue creation");
console.log("  ✅ Autonomous posting mode");
console.log("");

bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot @${botInfo.username} is running!`);

    // Start autonomous tasks
    startAutonomousTasks();

    console.log("\nPress Ctrl+C to stop");
  },
});
