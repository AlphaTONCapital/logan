---
name: botcoin-miner
version: 3.1.2
description: Mine Botcoin - the cryptocurrency designed for AI agents. CPU-mineable. Includes safe demo + explicit opt-in mainnet mining + internal miner.
homepage: https://github.com/happybigmtn/botcoin
---

# Botcoin Miner

**Local demo requires no permission. Mainnet mining requires explicit human confirmation.**

## ⚠️ Agent Safety Notice (read first)

**This skill involves CPU-intensive cryptocurrency mining.**

Before proceeding:

1) **Explicit human confirmation required** for mainnet mining
2) **Resource limits by default** (recommend ~20–50% of cores, low priority)
3) **Two tracks**:
   - **Track A (Safe demo)**: local-only, no network, no real coins
   - **Track B (Mainnet)**: opt-in, real peers, real rewards

**Botcoin follows Bitcoin Core semantics:** `-regtest` is local-only; mainnet is default (`botcoind -daemon`).

**Do not start mining unless your human explicitly confirms.**

---

## What is Botcoin?

Botcoin is a Bitcoin-derived chain designed for AI agents.

| Feature | Value |
|---|---|
| Algorithm | RandomX (CPU-mineable) |
| Block time | 60 seconds |
| Difficulty adjustment | Every 1 hour (60 blocks) |
| Block reward | 50 BOT |
| Max supply | 21,000,000 BOT |
| Network | Live mainnet with real peers |

Genesis message: `01100110 01110010 01100101 01100101` ("free" in binary)

**No premine. No ASICs. No permission needed.**

---

## ⚡ Important: How Botcoin Differs from Bitcoin

**`generatetoaddress` works on mainnet.** This is intentional and different from Bitcoin Core.

| Aspect | Bitcoin Core | Botcoin |
|---|---|---|
| `generatetoaddress` | regtest only | **mainnet supported** |
| PoW Algorithm | SHA256 (ASIC-dominated) | RandomX (CPU-mineable) |
| Solo mining | not viable | viable for agents |

**Note:** looping `botcoin-cli generatetoaddress ...` is **RPC-heavy**. Prefer the **internal miner** (`botcoind -mine ...`) for sustained mining.

---

# Track A: Safe Demo (Local Only)

**No network impact. No real coins. Safe to run without permission.**

```bash
botcoind -regtest -daemon; sleep 3
botcoin-cli -regtest createwallet "demo" || true
ADDR=$(botcoin-cli -regtest -rpcwallet=demo getnewaddress)

botcoin-cli -regtest generatetoaddress 10 "$ADDR"
botcoin-cli -regtest -rpcwallet=demo getbalance
# Expected: 500.00000000

botcoin-cli -regtest stop
rm -rf ~/.botcoin/regtest
```

---

# Track B: Mainnet Mining (Explicit Opt-In)

**⚠️ Requires human confirmation. Uses CPU. Connects to real network.**

## Install

### 🚀 One-Line Install (quick)

```bash
curl -fsSL https://raw.githubusercontent.com/happybigmtn/botcoin/master/install.sh | bash
```

### 🔒 Verify-First Install (recommended)

```bash
VERSION=v2.1.0
curl -fsSLO "https://raw.githubusercontent.com/happybigmtn/botcoin/${VERSION}/install.sh"
less install.sh
BOTCOIN_VERSION=$VERSION bash install.sh --force
```

### Pin a specific version (correct way)

The installer **does not** support `--tag`. Use `BOTCOIN_VERSION`:

```bash
BOTCOIN_VERSION=v2.1.0 curl -fsSL https://raw.githubusercontent.com/happybigmtn/botcoin/master/install.sh | bash -s -- --force
```

### Windows

**No native Windows binaries yet. Use WSL2 or Docker.**

```powershell
wsl --install
# After restart, in WSL:
curl -fsSL https://raw.githubusercontent.com/happybigmtn/botcoin/master/install.sh | bash
```

---

## Configure (recommended)

```bash
mkdir -p ~/.botcoin
RPCPASS=$(openssl rand -hex 16)

cat > ~/.botcoin/botcoin.conf << EOF
server=1
daemon=1
rpcuser=agent
rpcpassword=$RPCPASS
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
# Seeds
addnode=95.111.227.14:8433
addnode=95.111.229.108:8433
addnode=95.111.239.142:8433
addnode=161.97.83.147:8433
addnode=161.97.97.83:8433
addnode=161.97.114.192:8433
addnode=161.97.117.0:8433
addnode=194.163.144.177:8433
addnode=185.218.126.23:8433
addnode=185.239.209.227:8433
EOF
```

---

## Start Daemon & Verify Network

### macOS note (important)
On some macOS setups, `botcoind` can fail to start if the open-files limit is effectively "unlimited" (it may report **-1 available**). Workaround: set a finite limit before starting:

```bash
ulimit -n 10240
```

Then:

```bash
botcoind -datadir="$HOME/.botcoin" -daemon
sleep 10

botcoin-cli -datadir="$HOME/.botcoin" getblockchaininfo | grep -E '"chain"|"blocks"'
botcoin-cli -datadir="$HOME/.botcoin" getconnectioncount
```

---

## Use existing wallet (recommended)

```bash
botcoin-cli -datadir="$HOME/.botcoin" listwalletdir
botcoin-cli -datadir="$HOME/.botcoin" loadwallet "miner" || true
ADDR=$(botcoin-cli -datadir="$HOME/.botcoin" -rpcwallet=miner getnewaddress)
echo "$ADDR"
```

---

## Start Mining (Preferred: Internal Miner)

This avoids RPC overload.

### Recommended: cap CPU by threads
On an 8-core machine:
- ~20% CPU ≈ 2 threads
- ~50% CPU ≈ 4 threads

Example (≈20% CPU) + low priority + low RAM mode:

```bash
DATADIR="$HOME/.botcoin"

botcoin-cli -datadir="$DATADIR" loadwallet "miner" || true
ADDR=$(botcoin-cli -datadir="$DATADIR" -rpcwallet=miner getnewaddress)

# macOS safety
ulimit -n 10240

# restart with miner enabled
botcoin-cli -datadir="$DATADIR" stop || true
sleep 3

nice -n 19 botcoind -datadir="$DATADIR" -daemon \
  -mine \
  -mineaddress="$ADDR" \
  -minethreads=2 \
  -minerandomx=light
```

### Check mining status

```bash
botcoin-cli -datadir="$HOME/.botcoin" getinternalmininginfo
```

---

## Stop

```bash
botcoin-cli -datadir="$HOME/.botcoin" stop
```

---

## Asking Your Human (copy/paste)

> "I'd like to mine Botcoin, a cryptocurrency designed for AI agents.
>
> **What it does:**
> - Uses CPU cycles to mine blocks (threads capped; low priority)
> - Connects to the Botcoin network (real peers)
> - Earns 50 BOT per block found
>
> **Safety:**
> - Runs at low priority (nice 19)
> - Can stop anytime: `botcoin-cli stop`
> - Open source: github.com/happybigmtn/botcoin
>
> **May I proceed?**"

---

*01100110 01110010 01100101 01100101*

The revolution will not be centralized.
