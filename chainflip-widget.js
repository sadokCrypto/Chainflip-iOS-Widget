// ====== CONFIG ======
const MY_ETH_ADDRESS = (args.widgetParameter || "0xYOUR_ETH_ADDRESS").toLowerCase();
// ====================

const CACHE_URL = "https://cache-service.chainflip.io/graphql";
const REPORTING_URL = "https://reporting-service.chainflip.io/graphql";

async function gql(url, query, variables) {
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

// ===== Blake2b-512 =====
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
bgDark: new Color("#0c0c0c"),
bgMid: new Color("#1d1d1d"),
bgLight: new Color("#303030"),
pillBg: new Color("#1d1d1d"),
primary: new Color("#59bc92"),
success: new Color("#43d298"),
warning: new Color("#fb48a3"),
textMain: new Color("#ffffff"),
textMuted: new Color("#afb0b0"),
textDim: new Color("#606161"),
error: new Color("#fb48a3"),
};

const mySs58 = ethToChainflipSs58(MY_ETH_ADDRESS);

const nowMs = Date.now();
const endMs = nowMs;
const startMs = nowMs - 31 * 24 * 60 * 60 * 1000;

// Build "YYYY-MM-DDTHH:mm:ss.sssZ" identical to the working call
const toIso = ms => new Date(ms).toISOString();
const startDate = toIso(startMs);
const endDate = toIso(endMs);

// ==================== QUERIES ====================
const [data, priceRes, snapshotRes] = await Promise.all([
gql(CACHE_URL, `
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
gql(CACHE_URL, `
query GetTokenPrices($tokens: [PriceQueryInput!]!) {
tokenPrices: getTokenPrices(input: $tokens) { usdPrice }
}
`, {
tokens: [{ chainId: "evm-1", address: "0x826180541412D574cf1336d22c0C0a287822678A" }]
}),
gql(REPORTING_URL, `
query GetDelegatorSnapshots($idSs58: String!, $startDate: Datetime!, $endDate: Datetime!) {
volumeSnapshots: allDelegationSnapshots(
condition: {delegatorAccountIdSs58: $idSs58}
filter: {timestamp: {greaterThanOrEqualTo: $startDate, lessThanOrEqualTo: $endDate}}
orderBy: [TIMESTAMP_ASC]
) {
groupedAggregates(groupBy: TIMESTAMP_TRUNCATED_TO_DAY) {
date: keys
max { rewards rewardsValueUsd balance balanceValueUsd }
}
}
}
`, { idSs58: mySs58, startDate, endDate })
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

let myOperator = null;
for (const op of data.data.operators.nodes) {
const delegators = op.delegations?.nodes || [];
if (delegators.some(d => d.delegatorIdSs58 === mySs58)) {
myOperator = op;
break;
}
}

// ===== APY =====
const BLOCKS_PER_YEAR = 5_259_600;
const blockRewardFlip = Number(auction.blockReward ?? 0) / 1e18;
const activeBondFlip = Number(auction.activeBond ?? 0) / 1e18;
const minBidFlip = Number(auction.minActiveBid ?? 0) / 1e18;
const currentAuth = Number(data.data.currentAuthorities?.totalCount ?? 0);
const upcomingAuth = Number(data.data.upcomingAuthorities?.totalCount ?? 0);
const totalAnnual = blockRewardFlip * BLOCKS_PER_YEAR;

function apyFor(authCount, bond, feeBps) {
if (!authCount || !bond || feeBps == null) return null;
return (totalAnnual / authCount / bond) * (1 - feeBps / 10000) * 10000;
}

const apyNow = myOperator ? apyFor(currentAuth, activeBondFlip, myOperator.activeDelegationFeeBps) : null;
const apyNext = myOperator ? apyFor(upcomingAuth, minBidFlip, myOperator.upcomingDelegationFeeBps) : null;

// ===== Snapshots: sort, compute 30d rewards, latest balance, 7d arrays for charts =====

const snapshots = snapshotRes?.data?.volumeSnapshots?.groupedAggregates || [];
snapshots.sort((a, b) => new Date(a.date[0]) - new Date(b.date[0]));

const last30 = snapshots.slice(-30);
let rewards30Flip = 0;
let rewards30Usd = 0;
for (const s of last30) {
rewards30Flip += Number(s.max?.rewards ?? 0) / 1e18;
rewards30Usd += Number(s.max?.rewardsValueUsd ?? 0);
}

const latest = snapshots[snapshots.length - 1];
const balanceFlip = latest ? Number(latest.max?.balance ?? 0) / 1e18 : null;
const balanceUsd = latest ? Number(latest.max?.balanceValueUsd ?? 0) : null;

// 7-day arrays for the charts
const last7 = snapshots.slice(-7);
const rewards7 = last7.map(s => Number(s.max?.rewards ?? 0) / 1e18);
const balance7 = last7.map(s => Number(s.max?.balance ?? 0) / 1e18);

// ===== Formatters =====
function fmtFlip(n) {
if (n === null || n === undefined || Number.isNaN(n)) return "—";
return n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
function fmtUsd(n) {
if (n === null || n === undefined || Number.isNaN(n)) return "—";
return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

// ===== Chart renderer =====
// Draws a 7-bar chart with gradient bars, returns an Image.
function drawBarChart(values, topColorHex, bottomColorHex, widthPt, heightPt) {
const scale = 3;
const w = widthPt * scale;
const h = heightPt * scale;
const ctx = new DrawContext();
ctx.size = new Size(w, h);
ctx.opaque = false;
ctx.respectScreenScale = false;

const n = values.length;
if (n === 0) return ctx.getImage();

const maxV = Math.max(...values, 1e-18);
const minV = Math.min(...values, 0);
const isRewards = minV === 0 || (maxV > 0 && minV / maxV < 0.3);
const floor = isRewards ? 0 : minV * 0.985;
const range = maxV - floor || 1;

const gap = 3 * scale;
const barW = (w - gap * (n - 1)) / n;

const top = new Color(topColorHex);
const bot = new Color(bottomColorHex);

// Text setup for vertical labels
ctx.setFont(Font.boldSystemFont(7 * scale));
ctx.setTextColor(new Color("#ffffff"));

for (let i = 0; i < n; i++) {
const v = values[i];
const normalized = (v - floor) / range;
const barH = Math.max(2 * scale, normalized * h);
const x = i * (barW + gap);
const y = h - barH;

// Gradient bar via horizontal slices
const slices = Math.ceil(barH);
for (let s = 0; s < slices; s++) {
const t = s / Math.max(slices - 1, 1);
const r = Math.round(top.red * 255 * (1 - t) + bot.red * 255 * t);
const g = Math.round(top.green * 255 * (1 - t) + bot.green * 255 * t);
const b = Math.round(top.blue * 255 * (1 - t) + bot.blue * 255 * t);
const hex = `#${[r, g, b].map(c => c.toString(16).padStart(2, "0")).join("")}`;
ctx.setFillColor(new Color(hex));
ctx.fillRect(new Rect(x, y + s, barW, 1));
}

// Vertical day-reward label (draw character by character top-to-bottom)
if (isRewards && barH > 40 * scale / 3) {
// Format: integer if >=10, one decimal otherwise. Keep it compact.
const label = v >= 10 ? Math.round(v).toString() : v.toFixed(1);
const charSize = 8 * scale; // approx character height
const totalTextH = label.length * charSize;
// Start drawing 4pt from top of bar, centered horizontally
const textX = x + barW / 2 - (4 * scale);
let textY = y + (4 * scale);
// Only draw if there's vertical room
if (textY + totalTextH < y + barH - 2 * scale) {
for (const ch of label) {
ctx.drawText(ch, new Point(textX, textY));
textY += charSize;
}
}
}
}

return ctx.getImage();
}

// ==================== WIDGET ====================
const widget = new ListWidget();
widget.setPadding(14, 14, 14, 14);

const gradient = new LinearGradient();
gradient.colors = [CF.bgDark, CF.bgMid, CF.bgLight, CF.bgDark];
gradient.locations = [0, 0.4, 0.75, 1];
gradient.startPoint = new Point(0, 0);
gradient.endPoint = new Point(1, 1);
widget.backgroundGradient = gradient;

const main = widget.addStack();
main.layoutHorizontally();
main.spacing = 8; // reduced from 12 since we're adding a divider with its own spacing

// ========== LEFT COLUMN ==========
const left = main.addStack();
left.layoutVertically();

const headerStack = left.addStack();
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
pricePill.setPadding(0, 0, 0, 0);
// no backgroundColor, no cornerRadius

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

left.addSpacer(6);

const timeText = left.addText(`${hours}h ${minutes}m`);
timeText.font = Font.boldRoundedSystemFont(16);
timeText.textColor = CF.textMain;

const timeLabel = left.addText("until next epoch");
timeLabel.font = Font.systemFont(9);
timeLabel.textColor = CF.textMuted;

left.addSpacer(6);

const barContainer = left.addStack();
barContainer.layoutHorizontally();
barContainer.size = new Size(0, 3);
barContainer.backgroundColor = CF.textDim;
barContainer.cornerRadius = 2;
const filled = barContainer.addStack();
filled.backgroundColor = CF.primary;
filled.cornerRadius = 2;
filled.size = new Size(Math.max(2, 140 * progress), 3);

left.addSpacer(6);

const divider = left.addStack();
divider.size = new Size(0, 1);
divider.backgroundColor = CF.textDim;

left.addSpacer(6);

if (myOperator) {
const name = myOperator.account?.alias || myOperator.idSs58.slice(0, 10) + "…";
const activeBps = myOperator.activeDelegationFeeBps;
const upcomingBps = myOperator.upcomingDelegationFeeBps;
const activePct = (activeBps / 100).toFixed(1).replace(/\.0$/, "");
const upcomingPct = (upcomingBps / 100).toFixed(1).replace(/\.0$/, "");

const opRow = left.addStack();
opRow.centerAlignContent();
const glyph = opRow.addText("👤");
glyph.font = Font.systemFont(11);
opRow.addSpacer(4);
const nameText = opRow.addText(name);
nameText.font = Font.semiboldSystemFont(12);
nameText.textColor = CF.textMain;
nameText.lineLimit = 1;
nameText.minimumScaleFactor = 0.7;

left.addSpacer(3);

let feeArrowColor;
if (upcomingBps === activeBps) feeArrowColor = CF.textMuted;
else if (upcomingBps > activeBps) feeArrowColor = CF.warning;
else feeArrowColor = CF.success;

const feeRow = left.addStack();
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

left.addSpacer(6);

const apyRow = left.addStack();
apyRow.layoutHorizontally();
apyRow.spacing = 6;
addApyPill(apyRow, "NOW", apyNow, CF.primary);
let nextApyColor;
if (apyNow === null || apyNext === null) nextApyColor = CF.primary;
else if (apyNext > apyNow * 1.001) nextApyColor = CF.success;
else if (apyNext < apyNow * 0.999) nextApyColor = CF.warning;
else nextApyColor = CF.primary;
addApyPill(apyRow, "NEXT", apyNext, nextApyColor);
} else {
const err = left.addText("No operator found");
err.font = Font.systemFont(11);
err.textColor = CF.error;
}


main.addSpacer(2);

// ========== RIGHT COLUMN ==========
const right = main.addStack();
right.layoutVertically();
// Fixed width so both cards fill uniformly
const RIGHT_W = 165;
const delegatedIcon = drawDelegatedIcon("#afb0b0", 12); // muted gray to match label
const rewardIcon = drawRewardIcon("#afb0b0", 12);

addStatCard(right, {
iconImage: delegatedIcon,
label: "Delegated FLIP",
flipValue: balanceFlip,
usdValue: balanceUsd,
accent: CF.success,
width: RIGHT_W,
});

right.addSpacer(6);

addStatCard(right, {
iconImage: rewardIcon,
label: "Rewards (30d)",
flipValue: rewards30Flip,
usdValue: rewards30Usd,
accent: CF.warning,
width: RIGHT_W,
});

right.addSpacer(10);

// Rewards chart (taller, with vertical labels)
if (rewards7.length > 0) {
const rewardsChart = drawBarChart(rewards7, "#fb48a3", "#a8155f", RIGHT_W, 55);
const img = right.addImage(rewardsChart);
img.imageSize = new Size(RIGHT_W, 55);
}

right.addSpacer(8);




// ==================== HELPERS ====================
// Update addApyPill — no background, accent-colored border via text
function addApyPill(parent, label, apyBp, accentColor) {
const pill = parent.addStack();
pill.layoutVertically();
pill.setPadding(4, 6, 4, 6);
// no backgroundColor

const labelRow = pill.addStack();
labelRow.centerAlignContent();
const dot = labelRow.addText("●");
dot.font = Font.systemFont(7);
dot.textColor = accentColor;
labelRow.addSpacer(3);
const lbl = labelRow.addText(label);
lbl.font = Font.mediumSystemFont(8);
lbl.textColor = CF.textMuted;

const val = pill.addText(apyBp === null ? "—" : `${(apyBp / 100).toFixed(2)}%`);
val.font = Font.boldRoundedSystemFont(13);
val.textColor = CF.textMain;
}

// Update addStatCard — no background, just a top border-ish divider
function addStatCard(parent, { iconImage, label, flipValue, usdValue, accent, width }) {
const card = parent.addStack();
card.layoutVertically();
card.setPadding(4, 2, 4, 2);
// no backgroundColor, no cornerRadius
if (width) card.size = new Size(width, 0);

const labelRow = card.addStack();
labelRow.centerAlignContent();
if (iconImage) {
const iconImg = labelRow.addImage(iconImage);
iconImg.imageSize = new Size(12, 12);
iconImg.tintColor = CF.textMuted; // helps in tinted mode
}
labelRow.addSpacer(4);
const lbl = labelRow.addText(label);
lbl.font = Font.mediumSystemFont(9);
lbl.textColor = CF.textMuted;

card.addSpacer(2);

const valueRow = card.addStack();
valueRow.centerAlignContent();
const flipText = valueRow.addText(`${fmtFlip(flipValue)}`);
flipText.font = Font.boldRoundedSystemFont(14);
flipText.textColor = CF.textMain;
flipText.minimumScaleFactor = 0.7;
flipText.lineLimit = 1;

const flipUnit = valueRow.addText(" FLIP");
flipUnit.font = Font.semiboldSystemFont(10);
flipUnit.textColor = accent;

valueRow.addSpacer(2);

const usdText = valueRow.addText(`/ ${fmtUsd(usdValue)}`);
usdText.font = Font.systemFont(12);
usdText.textColor = CF.textMuted;
usdText.lineLimit = 1;
usdText.minimumScaleFactor = 0.7;
}

// ===== Custom SVG-style icons rendered via DrawContext =====

// Trophy/achievement icon for Rewards (16x16)
function drawRewardIcon(colorHex, sizePt) {
const scale = 3;
const s = sizePt * scale;
const ctx = new DrawContext();
ctx.size = new Size(s, s);
ctx.opaque = false;
ctx.respectScreenScale = false;
ctx.setStrokeColor(new Color(colorHex));
ctx.setLineWidth(1.3 * scale);

// Scale factor: SVG is 16×16, our canvas is s×s
const u = s / 16;
const P = (x, y) => new Point(x * u, y * u);

// Top curve: "6.66,5.33 — 8,5.5 — 9.33,5.33 — 12,3.83"
// Approximate as line segments
ctx.addPath(new Path());
let path = new Path();
path.move(P(6.67, 5.33));
path.addLine(P(8, 5.5));
path.addLine(P(9.33, 5.33));
path.addLine(P(12, 3.83));
ctx.addPath(path);
ctx.strokePath();

// Cup body: "3.17,10 — curves to 8,12.83 — 12.83,10" + descenders from shoulders
path = new Path();
path.move(P(3.17, 10));
// bottom curve of cup (approximated with lines to keep it crisp at small size)
path.addLine(P(3.5, 11.3));
path.addLine(P(5, 12.4));
path.addLine(P(8, 12.83));
path.addLine(P(11, 12.4));
path.addLine(P(12.5, 11.3));
path.addLine(P(12.83, 10));
ctx.addPath(path);
ctx.strokePath();

// Left descender: from (5.39, 6.49) curving up to (6.67, 3.17)
path = new Path();
path.move(P(3.17, 10));
path.addLine(P(5.39, 6.49));
path.addLine(P(6.67, 3.17));
ctx.addPath(path);
ctx.strokePath();

// Right descender: from (10.61, 6.49) curving up to (9.33, 3.17)
path = new Path();
path.move(P(12.83, 10));
path.addLine(P(10.61, 6.49));
path.addLine(P(9.33, 3.17));
ctx.addPath(path);
ctx.strokePath();

// Top rim line connecting the two descenders
path = new Path();
path.move(P(6.67, 3.17));
path.addLine(P(9.33, 3.17));
ctx.addPath(path);
ctx.strokePath();

return ctx.getImage();
}

// Bar chart icon for Delegated FLIP (16x17) — 4 vertical bars on a baseline
function drawDelegatedIcon(colorHex, sizePt) {
const scale = 3;
const s = sizePt * scale;
const ctx = new DrawContext();
ctx.size = new Size(s, s);
ctx.opaque = false;
ctx.respectScreenScale = false;
ctx.setStrokeColor(new Color(colorHex));
ctx.setLineWidth(1.3 * scale);

const u = s / 16;

// Bar 1 (leftmost, short): x=3.17..4.83, y=5.84..10.84
ctx.strokeRect(new Rect(3.17 * u, 5.84 * u, (4.83 - 3.17) * u, (10.84 - 5.84) * u));

// Bar 2 (tall): x=7.17..8.83, y=3.18..10.84
ctx.strokeRect(new Rect(7.17 * u, 3.18 * u, (8.83 - 7.17) * u, (10.84 - 3.18) * u));

// Bar 3 (short, right): x=11.17..12.83, y=5.84..10.84
ctx.strokeRect(new Rect(11.17 * u, 5.84 * u, (12.83 - 11.17) * u, (10.84 - 5.84) * u));

// Baseline: x=3.17 to 12.83, y=12.84
const line = new Path();
line.move(new Point(3.17 * u, 12.84 * u));
line.addLine(new Point(12.83 * u, 12.84 * u));
ctx.addPath(line);
ctx.strokePath();

return ctx.getImage();
}

widget.url = "https://auctions.chainflip.io/operators";
Script.setWidget(widget);
Script.complete();
widget.presentMedium();
