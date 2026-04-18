# Chainflip Delegator Widget

A polished iOS home screen widget for [Chainflip](https://chainflip.io) delegators. Shows the live epoch countdown, your operator's name, current & upcoming fees, and current & upcoming APY — all at a glance.

Built with [Scriptable](https://scriptable.app) (iOS). No app install, no account signup, no tracking. Just paste the script, drop in your ETH address, and you're done.


<img width="195" alt="Widget" src="https://github.com/user-attachments/assets/02a7b103-5d9b-457b-8ae3-abcf604b1b85" />


## Features

- ⏱ **Live epoch countdown** with a progress bar
- 💲 **FLIP price** updated in real time
- 👤 **Your operator** auto-detected from your ETH delegation address
- 📊 **Current & upcoming fees** with a trend arrow (pink = rising, green = dropping)
- 📈 **Current & upcoming APY** calculated using the official Chainflip formula
- 🎨 **Chainflip brand palette** — mediumaquamarine, mediumseagreen, hotpink, all-black gradient
- 🔒 **Zero dependencies, zero tracking** — one self-contained Scriptable file

## How it works

The widget queries the Chainflip cache-service GraphQL endpoint (`cache-service.chainflip.io/graphql`) for:

1. **Current auction state** — block reward, active bond, minimum active bid, end block, current block
2. **All operators** — their fees, delegator lists, and metadata
3. **Authority counts** — current and upcoming network-wide
4. **FLIP/USD price** — from the same cache-service

Your operator is identified by deriving a Chainflip SS58 address from your Ethereum delegation address and matching it against each operator's delegator list.

### ETH → SS58 derivation

Chainflip delegator accounts are derived as: `[12 zero bytes] || [20-byte ETH address]`, then SS58-encoded with network prefix `2112`. The script includes a pure-JS implementation of Blake2b-512 and Base58 encoding — no external libraries, works inside Scriptable's sandbox.

### APY formula

```
APY = (blockReward × blocksPerYear / authorityCount / bond) × (1 − fee)
```

Where:
- `blockReward` → FLIP emitted per block (from auction state)
- `blocksPerYear` = 5,259,600 (6-second blocks)
- `authorityCount` → current or upcoming authority count
- `bond` → `activeBond` (current) or `minActiveBid` (upcoming)
- `fee` → your operator's fee in basis points

This matches the auctions.chainflip.io dashboard within ~3%.

## Installation

### Prerequisites

- iPhone or iPad running iOS 14+
- [Scriptable](https://scriptable.app) installed (free)

### Setup

1. Open Scriptable and tap **+** to create a new script
2. Name it something like `Chainflip`
3. Paste the contents of [`chainflip-widget.js`](chainflip-widget.js) into the editor
4. Replace the default ETH address on line 2 with your own:
   ```js
   const MY_ETH_ADDRESS = (args.widgetParameter || "0xYOUR_ETH_ADDRESS").toLowerCase();
   ```
5. Tap the play button to test — a small widget preview should appear
6. On your home screen, long-press → **Add widget** → search **Scriptable** → choose **Small** size
7. Tap the widget to configure it:
   - **Script:** select your Chainflip script
   - **When Interacting:** Open URL (opens auctions.chainflip.io)
   - **Parameter:** *(optional)* paste your ETH address here to run multiple widgets for different addresses from the same script

### Multiple delegation addresses

You can reuse the same script across multiple widgets by leaving `MY_ETH_ADDRESS` as a default and passing each address through the widget **Parameter** field in the iOS widget editor. Each widget will show the operator data for whichever address is in its parameter.

## Customization

### Refresh interval

iOS controls widget refresh rate automatically (typically every 5–15 minutes). There's no way to force faster refresh from Scriptable, but tapping the widget opens auctions.chainflip.io for live data.

### Colors

All colors are defined in the `CF` palette object near the top of the script. Modify these to change the theme:

```js
const CF = {
  bgDark:    new Color("#0c0c0c"),  // gradient start
  bgLight:   new Color("#303030"),  // gradient end
  primary:   new Color("#59bc92"),  // brand accent
  success:   new Color("#43d298"),  // positive signal
  warning:   new Color("#fb48a3"),  // negative signal
  // ...
};
```

### Epoch length

The progress bar assumes a 3-day epoch (43,200 blocks). If Chainflip changes epoch duration, update:

```js
const EPOCH_BLOCKS = 43200;
```

## How the widget identifies your operator

1. The script derives your Chainflip SS58 from your ETH address
2. It fetches all operators and their delegator lists
3. It finds the operator whose delegator list contains your SS58
4. If you delegate to multiple operators, the first match wins (operators are returned in creation order)

If **"No operator found"** is displayed, either:
- Your ETH address isn't actually delegating (delegation hasn't settled yet)
- The cache-service is lagging (wait a few minutes and refresh)

## Troubleshooting

**Widget shows `—` for everything**
The GraphQL endpoint may be temporarily down. Tap the widget — if auctions.chainflip.io also fails, the API is offline. Otherwise, check for a Scriptable error by running the script manually.

**APY values look wrong**
The APY formula uses the **network-wide** bond (`activeBond`), not per-validator bond. Individual operators with higher-than-average bond may show ~5–15% lower real APY than displayed. Use the widget as a rough guide and confirm on auctions.chainflip.io for exact numbers.

**"No operator found" but I am delegating**
Delegations take ~1 epoch to show in the cache-service. If you just delegated, wait for the next epoch rollover.

## Technical notes

- **Blake2b-512 implementation**: ported from [blakejs](https://github.com/dcposch/blakejs) for pure-JS execution in Scriptable's sandbox
- **SS58 encoding**: follows the [Substrate SS58 spec](https://docs.substrate.io/reference/address-formats/) with Chainflip's registered prefix `2112`
- **No persistent storage**: each widget render re-fetches all data fresh
- **~30 KB script**: single file, no imports

## Credits

- Chainflip protocol team for the open GraphQL cache-service
- [simonbyrne/blakejs](https://github.com/dcposch/blakejs) for the Blake2b reference implementation

## Disclaimer

Not affiliated with Chainflip Labs. Widget data is best-effort and may lag or differ slightly from the official dashboard. Do not use this as the sole basis for delegation decisions.
