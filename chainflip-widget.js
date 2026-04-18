// ====== CONFIG ======
const MY_ETH_ADDRESS = (args.widgetParameter || "YOUR_ETH_ADDRESS").toLowerCase();
// ====================

const url = "https://cache-service.chainflip.io/graphql";

async function gql(query, variables) {
  const r = new Request(url);
  r.method = "POST";
  r.headers = { "Content-Type": "application/json" };
  r.body = JSON.stringify(variables ? { query, variables } : { query });
  return await r.loadJSON();
}

// ===== ETH → Chainflip SS58 =====
function ethToChainflipSs58(ethAddr) {
  const hex = ethAddr.toLowerCase().replace(/^0x/, "");
  if (hex.length !== 40) throw new Error("Invalid ETH address");
  const accountBytes = new Uint8Array(32);
  for (let i = 0; i < 20; i++) accountBytes[12 + i] = parseInt(hex.substr(i*2, 2), 16);
  return ss58Encode(accountBytes, 2112);
}

function ss58Encode(bytes, prefix) {
  const prefixBytes = [
    ((prefix & 0b11111100) >> 2) | 0b01000000,
    (prefix >> 8) | ((prefix & 0b00000011) << 6),
  ];
  const payload = new Uint8Array([...prefixBytes, ...bytes]);
  const ctx = "SS58PRE";
  const preimage = new Uint8Array(ctx.length + payload.length);
  for (let i = 0; i < ctx.length; i++) preimage[i] = ctx.charCodeAt(i);
  preimage.set(payload, ctx.length);
  const checksum = blake2b512(preimage).slice(0, 2);
  const full = new Uint8Array(payload.length + 2);
  full.set(payload, 0);
  full.set(checksum, payload.length);
  return base58Encode(full);
}

function base58Encode(bytes) {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) result += "1";
  for (let i = digits.length - 1; i >= 0; i--) result += ALPHABET[digits[i]];
  return result;
}

// ===== Blake2b-512 (port of blakejs, RFC 7693) =====
function blake2b512(input) {
  const BLAKE2B_IV32 = new Uint32Array([
    0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372,
    0x5f1d36f1, 0xa54ff53a, 0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c,
    0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19
  ]);
  const SIGMA8 = [
    0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15, 14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3,
    11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4, 7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8,
    9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13, 2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9,
    12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11, 13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10,
    6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5, 10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0,
    0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15, 14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3
  ];
  const SIGMA82 = new Uint8Array(SIGMA8.map(x => x * 2));
  const v = new Uint32Array(32);
  const m = new Uint32Array(32);

  function ADD64AA(a, b) {
    const o0 = v[a] + v[b];
    let o1 = v[a+1] + v[b+1];
    if (o0 >= 0x100000000) o1++;
    v[a] = o0; v[a+1] = o1;
  }
  function ADD64AC(a, b0, b1) {
    let o0 = v[a] + b0;
    if (b0 < 0) o0 += 0x100000000;
    let o1 = v[a+1] + b1;
    if (o0 >= 0x100000000) o1++;
    v[a] = o0; v[a+1] = o1;
  }
  function B2B_GET32(arr, i) {
    return (arr[i] ^ (arr[i+1] << 8) ^ (arr[i+2] << 16) ^ (arr[i+3] << 24));
  }
  function B2B_G(a, b, c, d, ix, iy) {
    const x0 = m[ix], x1 = m[ix+1], y0 = m[iy], y1 = m[iy+1];
    ADD64AA(a, b); ADD64AC(a, x0, x1);
    let xor0 = v[d] ^ v[a], xor1 = v[d+1] ^ v[a+1];
    v[d] = xor1; v[d+1] = xor0;
    ADD64AA(c, d);
    xor0 = v[b] ^ v[c]; xor1 = v[b+1] ^ v[c+1];
    v[b] = (xor0 >>> 24) ^ (xor1 << 8);
    v[b+1] = (xor1 >>> 24) ^ (xor0 << 8);
    ADD64AA(a, b); ADD64AC(a, y0, y1);
    xor0 = v[d] ^ v[a]; xor1 = v[d+1] ^ v[a+1];
    v[d] = (xor0 >>> 16) ^ (xor1 << 16);
    v[d+1] = (xor1 >>> 16) ^ (xor0 << 16);
    ADD64AA(c, d);
    xor0 = v[b] ^ v[c]; xor1 = v[b+1] ^ v[c+1];
    v[b] = (xor1 >>> 31) ^ (xor0 << 1);
    v[b+1] = (xor0 >>> 31) ^ (xor1 << 1);
  }

  const ctx = { b: new Uint8Array(128), h: new Uint32Array(16), t: 0, c: 0 };
  const paramBlock = new Uint8Array(64);
  paramBlock[0] = 64; paramBlock[2] = 1; paramBlock[3] = 1;
  for (let i = 0; i < 16; i++) ctx.h[i] = BLAKE2B_IV32[i] ^ B2B_GET32(paramBlock, i*4);

  function compress(last) {
    for (let i = 0; i < 16; i++) { v[i] = ctx.h[i]; v[i+16] = BLAKE2B_IV32[i]; }
    v[24] = v[24] ^ ctx.t;
    v[25] = v[25] ^ (ctx.t / 0x100000000);
    if (last) { v[28] = ~v[28]; v[29] = ~v[29]; }
    for (let i = 0; i < 32; i++) m[i] = B2B_GET32(ctx.b, 4*i);
    for (let i = 0; i < 12; i++) {
      B2B_G(0, 8, 16, 24, SIGMA82[i*16+0], SIGMA82[i*16+1]);
      B2B_G(2, 10, 18, 26, SIGMA82[i*16+2], SIGMA82[i*16+3]);
      B2B_G(4, 12, 20, 28, SIGMA82[i*16+4], SIGMA82[i*16+5]);
      B2B_G(6, 14, 22, 30, SIGMA82[i*16+6], SIGMA82[i*16+7]);
      B2B_G(0, 10, 20, 30, SIGMA82[i*16+8], SIGMA82[i*16+9]);
      B2B_G(2, 12, 22, 24, SIGMA82[i*16+10], SIGMA82[i*16+11]);
      B2B_G(4, 14, 16, 26, SIGMA82[i*16+12], SIGMA82[i*16+13]);
      B2B_G(6, 8, 18, 28, SIGMA82[i*16+14], SIGMA82[i*16+15]);
    }
    for (let i = 0; i < 16; i++) ctx.h[i] = ctx.h[i] ^ v[i] ^ v[i+16];
  }

  for (let i = 0; i < input.length; i++) {
    if (ctx.c === 128) { ctx.t += ctx.c; compress(false); ctx.c = 0; }
    ctx.b[ctx.c++] = input[i];
  }
  ctx.t += ctx.c;
  while (ctx.c < 128) ctx.b[ctx.c++] = 0;
  compress(true);
  const out = new Uint8Array(64);
  for (let i = 0; i < 64; i++) out[i] = (ctx.h[i >> 2] >> (8 * (i & 3))) & 0xff;
  return out;
}

// ==================== PALETTE ====================
const CF = {
  bgDark:     new Color("#0c0c0c"),  // black
  bgMid:      new Color("#1d1d1d"),  // black (29,29,29)
  bgLight:    new Color("#303030"),  // darkslategray (48,48,48)
  pillBg:     new Color("#1d1d1d"),  // pill background
  primary:    new Color("#59bc92"),  // mediumaquamarine — brand accent
  success:    new Color("#43d298"),  // mediumseagreen — APY rising
  warning:    new Color("#fb48a3"),  // hotpink — fee rising / APY falling
  textMain:   new Color("#ffffff"),
  textMuted:  new Color("#afb0b0"),  // darkgray
  textDim:    new Color("#606161"),  // dimgray
  error:      new Color("#fb48a3"),  // hotpink (doubles as error)
};

// ==================== MAIN ====================

const [data, priceRes] = await Promise.all([
  gql(`
    query EpochAndOperators {
      auction: auctionById(id: 1) {
        endBlockNumber
        currentHeight
        blockReward
        activeBond
        minActiveBid
      }
      upcomingAuthorities: allValidators(filter: {upcomingApyBp: {greaterThan: 0}}) {
        totalCount
      }
      currentAuthorities: allValidators(filter: {apyBp: {greaterThan: 0}}) {
        totalCount
      }
      operators: allOperators {
        nodes {
          idSs58
          activeDelegationFeeBps
          upcomingDelegationFeeBps
          account: accountByIdSs58 { alias }
          delegations: delegationsByOperatorIdSs58 {
            nodes { delegatorIdSs58 }
          }
        }
      }
    }
  `),
  gql(`
    query GetTokenPrices($tokens: [PriceQueryInput!]!) {
      tokenPrices: getTokenPrices(input: $tokens) {
        usdPrice
      }
    }
  `, {
    tokens: [{ chainId: "evm-1", address: "0x826180541412D574cf1336d22c0C0a287822678A" }]
  })
]);

const auction = data.data.auction;
const blocksLeft = auction.endBlockNumber - auction.currentHeight;
const secondsLeft = blocksLeft * 6;
const hours = Math.floor(secondsLeft / 3600);
const minutes = Math.floor((secondsLeft % 3600) / 60);

const EPOCH_BLOCKS = 43200;
const elapsed = EPOCH_BLOCKS - blocksLeft;
const progress = Math.max(0, Math.min(1, elapsed / EPOCH_BLOCKS));

const flipPrice = priceRes?.data?.tokenPrices?.[0]?.usdPrice ?? null;

const mySs58 = ethToChainflipSs58(MY_ETH_ADDRESS);
let myOperator = null;
for (const op of data.data.operators.nodes) {
  const delegators = op.delegations?.nodes || [];
  if (delegators.some(d => d.delegatorIdSs58 === mySs58)) {
    myOperator = op;
    break;
  }
}

// ===== APY calculation =====
const BLOCKS_PER_YEAR = 5_259_600;
const blockRewardFlip = Number(auction.blockReward  ?? 0) / 1e18;
const activeBondFlip  = Number(auction.activeBond   ?? 0) / 1e18;
const minBidFlip      = Number(auction.minActiveBid ?? 0) / 1e18;
const currentAuth     = Number(data.data.currentAuthorities?.totalCount  ?? 0);
const upcomingAuth    = Number(data.data.upcomingAuthorities?.totalCount ?? 0);

const totalAnnual = blockRewardFlip * BLOCKS_PER_YEAR;

function apyFor(authCount, bond, feeBps) {
  if (!authCount || !bond || feeBps == null) return null;
  return (totalAnnual / authCount / bond) * (1 - feeBps / 10000) * 10000;
}

const apyNow  = myOperator ? apyFor(currentAuth,  activeBondFlip, myOperator.activeDelegationFeeBps)   : null;
const apyNext = myOperator ? apyFor(upcomingAuth, minBidFlip,     myOperator.upcomingDelegationFeeBps) : null;

// ===== Widget =====
const widget = new ListWidget();
widget.setPadding(14, 14, 14, 14);

const gradient = new LinearGradient();
gradient.colors = [CF.bgDark, CF.bgMid, CF.bgLight, CF.bgDark];
gradient.locations = [0, 0.4, 0.75, 1];
gradient.startPoint = new Point(0, 0);
gradient.endPoint = new Point(1, 1);
widget.backgroundGradient = gradient;

// Header
const headerStack = widget.addStack();
headerStack.centerAlignContent();

const headerLeft = headerStack.addStack();
headerLeft.layoutVertically();
const header = headerLeft.addText("CHAINFLIP");
header.font = Font.boldSystemFont(9);
header.textColor = CF.primary;
const liveRow = headerLeft.addStack();
liveRow.centerAlignContent();
const liveDot = liveRow.addText("●");
liveDot.font = Font.systemFont(7);
liveDot.textColor = CF.success;
liveRow.addSpacer(3);
const liveLabel = liveRow.addText("live");
liveLabel.font = Font.systemFont(7);
liveLabel.textColor = CF.textMuted;

headerStack.addSpacer();

const pricePill = headerStack.addStack();
pricePill.layoutVertically();
pricePill.setPadding(4, 7, 4, 7);
pricePill.backgroundColor = CF.pillBg;
pricePill.cornerRadius = 6;

const flipLabelRow = pricePill.addStack();
flipLabelRow.centerAlignContent();
const flipDot = flipLabelRow.addText("●");
flipDot.font = Font.systemFont(6);
flipDot.textColor = CF.primary;
flipLabelRow.addSpacer(3);
const flipLbl = flipLabelRow.addText("FLIP");
flipLbl.font = Font.mediumSystemFont(8);
flipLbl.textColor = CF.textMuted;

const priceText = pricePill.addText(flipPrice !== null ? `$${flipPrice.toFixed(3)}` : "—");
priceText.font = Font.boldRoundedSystemFont(11);
priceText.textColor = CF.textMain;

widget.addSpacer(0);

// Time hero
const timeText = widget.addText(`${hours}h ${minutes}m`);
timeText.font = Font.boldRoundedSystemFont(12);
timeText.textColor = CF.textMain;

const timeLabel = widget.addText("until next epoch");
timeLabel.font = Font.systemFont(9);
timeLabel.textColor = CF.textMuted;

widget.addSpacer(6);

// Progress bar
const barContainer = widget.addStack();
barContainer.layoutHorizontally();
barContainer.size = new Size(0, 3);
barContainer.backgroundColor = CF.textDim;
barContainer.cornerRadius = 2;

const filled = barContainer.addStack();
filled.backgroundColor = CF.primary;
filled.cornerRadius = 2;
filled.size = new Size(Math.max(2, 127 * progress), 3);

widget.addSpacer(2);

const divider = widget.addStack();
divider.size = new Size(0, 1);
divider.backgroundColor = CF.textDim;

widget.addSpacer(8);

if (myOperator) {
  const name = myOperator.account?.alias || myOperator.idSs58.slice(0, 10) + "…";
  const activeBps = myOperator.activeDelegationFeeBps;
  const upcomingBps = myOperator.upcomingDelegationFeeBps;
  const activePct = (activeBps / 100).toFixed(1).replace(/\.0$/, "");
  const upcomingPct = (upcomingBps / 100).toFixed(1).replace(/\.0$/, "");

  // Operator name
  const opRow = widget.addStack();
  opRow.centerAlignContent();
  const glyph = opRow.addText("👤");
  glyph.font = Font.systemFont(11);
  opRow.addSpacer(4);
  const nameText = opRow.addText(name);
  nameText.font = Font.semiboldSystemFont(12);
  nameText.textColor = CF.textMain;
  nameText.lineLimit = 1;
  nameText.minimumScaleFactor = 0.7;

  widget.addSpacer(3);

  // Fees line below name
  let feeArrowColor;
  if (upcomingBps === activeBps) feeArrowColor = CF.textMuted;
  else if (upcomingBps > activeBps) feeArrowColor = CF.warning;  // fee rising = pink
  else feeArrowColor = CF.success;                                // fee dropping = green

  const feeRow = widget.addStack();
  feeRow.centerAlignContent();
  const feeLbl = feeRow.addText("Fees ");
  feeLbl.font = Font.mediumSystemFont(10);
  feeLbl.textColor = CF.textMuted;
  const feeNow = feeRow.addText(`${activePct}%`);
  feeNow.font = Font.systemFont(10);
  feeNow.textColor = CF.textMain;
  const feeArrow = feeRow.addText(" → ");
  feeArrow.font = Font.systemFont(10);
  feeArrow.textColor = feeArrowColor;
  const feeNext = feeRow.addText(`${upcomingPct}%`);
  feeNext.font = Font.systemFont(10);
  feeNext.textColor = CF.textMain;

  widget.addSpacer(6);

  // APY pills
  const apyRow = widget.addStack();
  apyRow.layoutHorizontally();
  apyRow.spacing = 8;

  addApyPill(apyRow, "NOW", apyNow, CF.primary);

  let nextApyColor;
  if (apyNow === null || apyNext === null) nextApyColor = CF.primary;
  else if (apyNext > apyNow * 1.001) nextApyColor = CF.success;   // rising = green
  else if (apyNext < apyNow * 0.999) nextApyColor = CF.warning;   // falling = pink
  else nextApyColor = CF.primary;

  addApyPill(apyRow, "NEXT", apyNext, nextApyColor);
} else {
  const err = widget.addText("No operator found");
  err.font = Font.systemFont(11);
  err.textColor = CF.error;
}

function addApyPill(parent, label, apyBp, accentColor) {
  const pill = parent.addStack();
  pill.layoutVertically();
  pill.setPadding(5, 8, 5, 8);
  pill.backgroundColor = CF.pillBg;
  pill.cornerRadius = 6;

  const labelRow = pill.addStack();
  labelRow.centerAlignContent();
  const dot = labelRow.addText("●");
  dot.font = Font.systemFont(6);
  dot.textColor = accentColor;
  labelRow.addSpacer(3);
  const lbl = labelRow.addText(label);
  lbl.font = Font.mediumSystemFont(8);
  lbl.textColor = CF.textMuted;

  const val = pill.addText(apyBp === null ? "—" : `${(apyBp / 100).toFixed(2)}%`);
  val.font = Font.boldRoundedSystemFont(10);
  val.textColor = CF.textMain;
}

widget.url = "https://auctions.chainflip.io/operators";
Script.setWidget(widget);
Script.complete();
widget.presentSmall();
