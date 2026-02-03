# TON Scaffolding - Blueprint dApp Generator

## Overview

**Repository:** https://github.com/alphatoncapital/ton-scaffolding
**Purpose:** Blueprint plugin that transforms FunC contract wrappers into full React dApps

ton-scaffolding parses Blueprint wrappers and generates a React application for interacting with smart contract methods through a UI.

## Installation

```bash
# Add to package.json
yarn add blueprint-scaffold

# Add to blueprint.config.ts
import { ScaffoldPlugin } from 'blueprint-scaffold';

export const config = {
  plugins: [
    new ScaffoldPlugin(),
  ]
};

# Run scaffold
yarn blueprint scaffold
```

## Wrapper Requirements

For a contract to be included in the generated dApp, its wrapper must meet these requirements:

### 1. File Naming
- Wrapper file: `wrappers/ContractName.ts`
- Class name must match filename body (e.g., `JettonMinter` in `JettonMinter.ts`)

### 2. Required Methods

#### createFromAddress (Required)
```typescript
static createFromAddress(address: Address) {
    return new ContractName(address);
}
```

#### sendFunctions (At least one required)
Must start with `send`, receive `provider: ContractProvider` and `via: Sender`:

```typescript
async sendMint(
    provider: ContractProvider,
    via: Sender,
    to: Address,
    amount: bigint
) {
    await provider.internal(via, {
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell()...endCell(),
        value: toNano('0.1'),
    });
}
```

#### getFunctions (Optional)
Same as sendFunctions but without `via` argument:

```typescript
async getBalance(provider: ContractProvider, owner: Address) {
    const res = await provider.get('get_balance', [...]);
    return res.stack.readBigNumber();
}
```

### 3. Deploy Support (Optional)

For Deploy button in UI, add `createFromConfig`:

```typescript
export type ContractConfig = {
    admin: Address;
    content: Cell;
};

static createFromConfig(config: ContractConfig, code: Cell, workchain = 0) {
    const data = configToCell(config);
    const init = { code, data };
    return new ContractName(contractAddress(workchain, init), init);
}
```

## Configuration

### wrappers.json
Located at `dapp/src/config/wrappers.json` - delete methods/wrappers to exclude them.

### config.json
Located at `dapp/src/config/config.json`:

```json
{
  "JettonMinter": {
    "defaultAddress": "",
    "tabName": "Minter",
    "sendFunctions": {
      "sendMint": {
        "tabName": "Mint",
        "params": {
          "to": { "fieldTitle": "Receiver" },
          "amount": { "fieldTitle": "Amount" }
        }
      }
    },
    "getFunctions": {
      "getBalance": {
        "tabName": "Check Balance",
        "params": {
          "owner": { "fieldTitle": "Owner Address" }
        },
        "outNames": ["Balance"]
      }
    }
  }
}
```

### Configuration Options

| Option | Description |
|--------|-------------|
| `defaultAddress` | Fixed address (hides address input and Deploy button) |
| `tabName` | Display alias for wrapper or method |
| `fieldTitle` | Display alias for parameter input |
| `outNames` | Names for get function return values |
| `overrideWithDefault` | Hide field, use defaultValue instead |

## URL Parameters

### Via Arguments
```
https://my-dapp.xyz/?wrapper=JettonMinter
https://my-dapp.xyz/?wrapper=JettonMinter&method=sendMint
https://my-dapp.xyz/?wrapper=JettonMinter&method=sendMint&address=EQAddr
```

### Via Paths (localhost only)
```
http://localhost:5173/JettonMinter/sendMint/EQAddr
```

### Multiple Addresses
```
https://my-dapp.xyz/?JettonMinter=EQAddr1&JettonWallet=EQAddr2
```

### Default Values
```
https://my-dapp.xyz/?wrapper=JettonMinter&method=sendMint&amount=toNano('100')
```

## Supported Types

### Basic Types
- `Address` - TON address
- `Cell` - TON cell
- `Buffer` - Binary data
- `bigint` - Large integers

### Special Types (in components/Fields/special/)
- `Bool` - Boolean toggle
- `Array` - Multiple values
- `Null` - Optional/nullable

## Commands

```bash
# Generate dApp from scratch
yarn blueprint scaffold

# Update wrappers and config only (preserves customizations)
yarn blueprint scaffold --update

# Run development server
cd dapp && yarn && yarn dev
```

## Telegram Bot Integration

ton-scaffolding includes grammy for Telegram bot development:

```typescript
import { Bot } from 'grammy';

const bot = new Bot(process.env.BOT_TOKEN);

bot.command('start', (ctx) => {
  ctx.reply('Welcome to the TON dApp!');
});

bot.start();
```

See `TELEGRAM_BOT_SETUP.md` for detailed bot configuration.

## Best Practices

1. **Wrapper Organization**
   - One wrapper per contract
   - Clear method naming (sendX, getX)
   - Comprehensive TypeScript types

2. **Configuration**
   - Use meaningful tabNames and fieldTitles
   - Set appropriate defaultValues for common parameters
   - Use outNames to clarify return values

3. **Security**
   - Never hardcode private keys
   - Validate user inputs before transactions
   - Use appropriate gas limits

## Integration with AlphaTON

ton-scaffolding is AlphaTON Capital's tool for rapidly building TON dApps. Use it to:

- Create user interfaces for TON smart contracts
- Build Telegram Mini Apps with TON integration
- Deploy interactive contract explorers
- Prototype DeFi applications
