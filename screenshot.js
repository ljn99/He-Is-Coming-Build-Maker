// ---------- Load a build from a screenshot ----------
//
// How it works, in short:
//  1. Find the item slot frames in the picture (the cream-coloured boxes).
//  2. Cut out the sprite inside each frame and compare it, pixel by pixel,
//     with every sprite we know about (data/sprite-masks.json).
//  3. Do the same for the weapon, and for the edge and oil icons if the
//     screenshot shows them (the game-over panel or a weapon tooltip).
//  4. Hand the result to applyBuild(), the same function Load uses.
//
// The game draws every sprite pixel as a 4x4 block, and a slot frame is 114
// screenshot pixels wide. If a screenshot has a different size, we shrink or
// enlarge it first so those numbers hold.

const SPRITE_MASKS_URL = "data/sprite-masks.json";
const SPRITE_SIZE = 18;                    // sprites are 18x18 game pixels
const SPRITE_CELLS = SPRITE_SIZE * SPRITE_SIZE;
const BLOCK = 4;                           // one game pixel = 4x4 screenshot pixels
const FRAME_WIDTH = 114;                   // slot frame width after normalising
const FRAME_HEIGHT = 115;                  // full frame height including the number label
const MIN_MATCH = 0.75;                    // below this a slot counts as "not recognised"
const MIN_ICON_MATCH = 0.8;                // edge/oil icons need a closer match

let spriteBanksPromise = null;

// ---------- Sprite data ----------

// "00ff..." (81 hex characters) -> 324 numbers, each 0 or 1.
function hexToMask(hex) {
    const mask = new Float32Array(SPRITE_CELLS);
    for (let i = 0; i < hex.length; i++) {
        const value = parseInt(hex[i], 16);
        for (let bit = 0; bit < 4; bit++) {
            mask[i * 4 + bit] = (value >> (3 - bit)) & 1;
        }
    }
    return mask;
}

// A "bank" holds many sprite masks, plus copies of each one nudged by a few
// pixels, because the sprite is never centred perfectly in the slot.
function makeBank(entries, maxShift) {
    const shifts = [];
    for (let dy = -maxShift; dy <= maxShift; dy++) {
        for (let dx = -maxShift; dx <= maxShift; dx++) {
            const shifted = new Float32Array(entries.length * SPRITE_CELLS);
            entries.forEach((entry, n) => {
                for (let y = 0; y < SPRITE_SIZE; y++) {
                    for (let x = 0; x < SPRITE_SIZE; x++) {
                        const sourceY = y - dy;
                        const sourceX = x - dx;
                        if (sourceY >= 0 && sourceY < SPRITE_SIZE && sourceX >= 0 && sourceX < SPRITE_SIZE) {
                            shifted[n * SPRITE_CELLS + y * SPRITE_SIZE + x] = entry.mask[sourceY * SPRITE_SIZE + sourceX];
                        }
                    }
                }
            });
            shifts.push(shifted);
        }
    }
    return { entries, shifts };
}

function loadSpriteBanks() {
    if (!spriteBanksPromise) {
        spriteBanksPromise = fetch(SPRITE_MASKS_URL + "?v=12")
            .then(response => response.json())
            .then(list => {
                const entries = list.map(([kind, id, tier, hex]) => ({ kind, id, tier, mask: hexToMask(hex) }));
                const of = (kind, tier) => entries.filter(entry => entry.kind === kind && (tier === undefined || entry.tier === tier));
                return {
                    items: [makeBank(of("item", 0), 1), makeBank(of("item", 1), 1), makeBank(of("item", 2), 1)],
                    weapons: makeBank(of("weapon"), 1),
                    icons: makeBank(entries.filter(entry => entry.kind === "edge" || entry.kind === "oil"), 2)
                };
            });
    }
    return spriteBanksPromise;
}

// ---------- Image preparation ----------

// Redraw the picture at a different size and read its pixels.
function renderBitmap(bitmap, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
}

// The screenshots have a CRT "scanline" effect: every 4th row is darker.
// Averaging 4 rows together removes it. Then we keep, for every pixel, the
// brightest and darkest colour channel, which is all the rest needs.
function preparePixels(rgba, width, height) {
    const smooth = [new Float32Array(width * height), new Float32Array(width * height), new Float32Array(width * height)];
    for (let channel = 0; channel < 3; channel++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                for (let k = -2; k <= 1; k++) {
                    const yy = Math.min(height - 1, Math.max(0, y + k));
                    sum += rgba[(yy * width + x) * 4 + channel];
                }
                smooth[channel][y * width + x] = sum / 4;
            }
        }
    }
    const red = smooth[0];
    const green = smooth[1];
    const blue = smooth[2];
    const brightest = new Uint8Array(width * height);
    const darkest = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        brightest[i] = Math.max(red[i], green[i], blue[i]);
        darkest[i] = Math.min(red[i], green[i], blue[i]);
    }
    return { width, height, red, green, blue, brightest, darkest };
}

// Grow every "on" pixel of a mask by `radius` pixels in each direction.
function dilate(mask, width, height, radius) {
    const horizontal = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        const prefix = new Int32Array(width + 1);
        for (let x = 0; x < width; x++) {
            prefix[x + 1] = prefix[x] + mask[y * width + x];
        }
        for (let x = 0; x < width; x++) {
            const from = Math.max(0, x - radius);
            const to = Math.min(width, x + radius + 1);
            horizontal[y * width + x] = prefix[to] - prefix[from] > 0 ? 1 : 0;
        }
    }
    const result = new Uint8Array(width * height);
    for (let x = 0; x < width; x++) {
        const prefix = new Int32Array(height + 1);
        for (let y = 0; y < height; y++) {
            prefix[y + 1] = prefix[y] + horizontal[y * width + x];
        }
        for (let y = 0; y < height; y++) {
            const from = Math.max(0, y - radius);
            const to = Math.min(height, y + radius + 1);
            result[y * width + x] = prefix[to] - prefix[from] > 0 ? 1 : 0;
        }
    }
    return result;
}

// Find groups of touching "on" pixels and return their bounding boxes.
function components(mask, width, height) {
    const seen = new Uint8Array(width * height);
    const stack = new Int32Array(width * height);
    const boxes = [];
    for (let start = 0; start < width * height; start++) {
        if (!mask[start] || seen[start]) {
            continue;
        }
        let top = 0;
        stack[top++] = start;
        seen[start] = 1;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        while (top > 0) {
            const index = stack[--top];
            const x = index % width;
            const y = (index - x) / width;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                        continue;
                    }
                    const next = ny * width + nx;
                    if (mask[next] && !seen[next]) {
                        seen[next] = 1;
                        stack[top++] = next;
                    }
                }
            }
        }
        boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    }
    return boxes;
}

// ---------- Finding the slots ----------

function creamComponents(image) {
    const mask = new Uint8Array(image.width * image.height);
    for (let i = 0; i < mask.length; i++) {
        mask[i] = image.darkest[i] > 130 ? 1 : 0;
    }
    return components(dilate(mask, image.width, image.height, 2), image.width, image.height);
}

// Item slots are cream boxes about 114 pixels wide, sitting in two columns
// 144-152 pixels apart (it depends on the screen layout). When the screenshot
// shows two builds (you and an opponent), we take the one on the left.
// Returns the slots in reading order (left to right, top to bottom) and the
// horizontal centre of the panel they sit in.
function findSlots(boxes) {
    const frames = boxes.filter(box =>
        Math.abs(box.w - FRAME_WIDTH) <= 3 &&
        ((box.h >= 96 && box.h <= 101) || (box.h >= 112 && box.h <= 117)));
    if (frames.length === 0) {
        return { slots: [], centerX: 0 };
    }

    const columns = [];
    frames.forEach(frame => {
        const column = columns.find(candidate => Math.abs(candidate.x - frame.x) <= 4);
        if (column) {
            column.count++;
        } else {
            columns.push({ x: frame.x, count: 1 });
        }
    });

    columns.sort((a, b) => a.x - b.x);
    let best = null;
    columns.forEach(left => {
        columns.forEach(right => {
            const gap = right.x - left.x;
            if (gap >= 138 && gap <= 158) {
                const score = left.count + right.count;
                if (!best || score > best.score) {
                    best = { score, left: left.x, right: right.x };
                }
            }
        });
    });
    if (!best) {
        return { slots: [], centerX: 0 };
    }

    const slots = frames.filter(frame => Math.abs(frame.x - best.left) <= 4 || Math.abs(frame.x - best.right) <= 4);
    const rows = [];
    slots.sort((a, b) => (a.y + a.h) - (b.y + b.h));
    slots.forEach(frame => {
        const bottom = frame.y + frame.h;
        const row = rows.find(candidate => Math.abs(candidate.bottom - bottom) <= 10);
        if (row) {
            row.frames.push(frame);
        } else {
            rows.push({ bottom, frames: [frame] });
        }
    });
    const ordered = [];
    rows.forEach(row => {
        row.frames.sort((a, b) => a.x - b.x);
        row.frames.forEach(frame => ordered.push(frame));
    });
    return { slots: ordered, centerX: (best.left + best.right + FRAME_WIDTH) / 2 };
}

// The weapon sits in a red frame. If the screenshot shows two builds there are
// two of them, so we take the one above the item slots we are reading.
function findWeaponFrame(image, centerX) {
    const mask = new Uint8Array(image.width * image.height);
    for (let i = 0; i < mask.length; i++) {
        mask[i] = image.red[i] > 150 && image.green[i] < 85 && image.blue[i] < 100 ? 1 : 0;
    }
    const boxes = components(dilate(mask, image.width, image.height, 3), image.width, image.height)
        .filter(box => box.w >= 95 && box.w <= 160 && box.h >= 85 && box.h <= 160 && Math.abs(box.w - box.h) <= 30);
    boxes.sort((a, b) => Math.abs(a.x + a.w / 2 - centerX) - Math.abs(b.x + b.w / 2 - centerX));
    return boxes.length > 0 && Math.abs(boxes[0].x + boxes[0].w / 2 - centerX) < 150 ? boxes[0] : null;
}

// ---------- Comparing sprites ----------

// Where does the sprite end and the background begin? Screenshots differ in
// brightness, so we pick the cut-off from the picture itself: halfway between
// the dim background and the brightest sprite colour in that area.
function adaptiveThreshold(image, x0, y0, x1, y1) {
    const histogram = new Int32Array(256);
    let total = 0;
    for (let y = Math.max(0, y0); y < Math.min(image.height, y1); y++) {
        for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x++) {
            histogram[image.brightest[y * image.width + x]]++;
            total++;
        }
    }
    if (total === 0) {
        return 255;
    }
    const percentile = fraction => {
        let running = 0;
        for (let value = 0; value < 256; value++) {
            running += histogram[value];
            if (running >= fraction * total) {
                return value;
            }
        }
        return 255;
    };
    const background = percentile(0.2);
    const peak = percentile(0.99);
    return background + 0.5 * (peak - background);
}

// Split the area into an 18x18 grid of 4x4 blocks and measure how much of each
// block is "lit". Result values run from 0 (dark) to 1 (fully lit).
function coverage(image, threshold, originX, originY, out) {
    for (let j = 0; j < SPRITE_SIZE; j++) {
        for (let i = 0; i < SPRITE_SIZE; i++) {
            const top = originY + j * BLOCK;
            const left = originX + i * BLOCK;
            let value = 0;
            if (top >= 0 && left >= 0 && top + BLOCK <= image.height && left + BLOCK <= image.width) {
                let lit = 0;
                for (let yy = 0; yy < BLOCK; yy++) {
                    const row = (top + yy) * image.width + left;
                    for (let xx = 0; xx < BLOCK; xx++) {
                        if (image.brightest[row + xx] > threshold) {
                            lit++;
                        }
                    }
                }
                value = lit / (BLOCK * BLOCK);
            }
            out[j * SPRITE_SIZE + i] = value;
        }
    }
}

function softCoverage(raw, out) {
    for (let i = 0; i < raw.length; i++) {
        out[i] = Math.min(1, Math.max(0, (raw[i] - 0.15) / 0.5));
    }
}

// "Intersection over union": 1 means identical shapes, 0 means nothing in common.
function similarity(bank, cells, candidates) {
    const scores = new Float32Array(bank.entries.length);
    candidates.forEach(n => {
        let best = 0;
        for (let s = 0; s < bank.shifts.length; s++) {
            const shifted = bank.shifts[s];
            let inter = 0;
            let union = 0;
            const offset = n * SPRITE_CELLS;
            for (let c = 0; c < SPRITE_CELLS; c++) {
                const a = shifted[offset + c];
                const b = cells[c];
                if (a < b) {
                    inter += a;
                    union += b;
                } else {
                    inter += b;
                    union += a;
                }
            }
            if (union > 0 && inter / union > best) {
                best = inter / union;
            }
        }
        scores[n] = best;
    });
    return scores;
}

function allCandidates(bank) {
    return bank.entries.map((entry, index) => index);
}

// Find the sprite in `bank` that best matches the picture around (originX, originY).
// `bonus(entry)` can nudge scores, for example to prefer the right rarity.
// Returns the best few matches, best first: [{entry, score, adjusted}].
function matchSprite(image, bank, originX, originY, threshold, bonus, phaseRange) {
    const range = phaseRange === undefined ? 3 : phaseRange;
    const raw = new Float32Array(SPRITE_CELLS);
    const cells = new Float32Array(SPRITE_CELLS);
    const bonuses = bank.entries.map(entry => (bonus ? bonus(entry) : 0));

    // Stage 1: try every sprite at the one alignment that looks sharpest.
    let sharpest = null;
    for (let py = -range; py <= range; py++) {
        for (let px = -range; px <= range; px++) {
            coverage(image, threshold, originX + px, originY + py, raw);
            let contrast = 0;
            for (let i = 0; i < raw.length; i++) {
                contrast += Math.abs(raw[i] - 0.5);
            }
            if (!sharpest || contrast > sharpest.contrast) {
                sharpest = { contrast, px, py };
            }
        }
    }
    coverage(image, threshold, originX + sharpest.px, originY + sharpest.py, raw);
    softCoverage(raw, cells);
    const first = similarity(bank, cells, allCandidates(bank));
    const ranked = allCandidates(bank).sort((a, b) => (first[b] + bonuses[b]) - (first[a] + bonuses[a])).slice(0, 8);

    // Stage 2: re-check only the best few at every nearby alignment.
    const best = new Map(ranked.map(n => [n, 0]));
    for (let py = -range; py <= range; py++) {
        for (let px = -range; px <= range; px++) {
            coverage(image, threshold, originX + px, originY + py, raw);
            softCoverage(raw, cells);
            const scores = similarity(bank, cells, ranked);
            ranked.forEach(n => {
                if (scores[n] > best.get(n)) {
                    best.set(n, scores[n]);
                }
            });
        }
    }
    return ranked
        .map(n => ({ entry: bank.entries[n], score: best.get(n), adjusted: best.get(n) + bonuses[n] }))
        .sort((a, b) => b.adjusted - a.adjusted)
        .slice(0, 3);
}

// ---------- Reading one slot ----------

// The little marker in a slot's top-right corner tells us the tier (gold or
// diamond gem) or the rarity (a coloured dot).
function readGem(image, frame) {
    const top = frame.y + frame.h - FRAME_HEIGHT;
    const x0 = frame.x + frame.w - 34;
    const x1 = frame.x + frame.w + 6;
    let count = 0, red = 0, green = 0, blue = 0;
    for (let y = Math.max(0, top - 6); y < Math.min(image.height, top + 30); y++) {
        for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x++) {
            const i = y * image.width + x;
            if (image.brightest[i] > 90 && image.darkest[i] <= 150) {
                count++;
                red += image.red[i];
                green += image.green[i];
                blue += image.blue[i];
            }
        }
    }
    if (count <= 5) {
        return { tier: 0, rarity: null };
    }
    red /= count;
    green /= count;
    blue /= count;
    if (count > 350) {
        // Big markers: a gem (gold or cyan diamond) or the wrapped-candy icon
        // that marks cauldron items. The candy is a bit bigger than the gems,
        // and its gold version has the same shape as the salmon one.
        const blueShare = blue / red;
        if (count > 480) {
            return { tier: 0, rarity: blueShare < 0.38 ? "cauldron_gold" : "cauldron" };
        }
        if (blue > red && green > red) {
            return { tier: 2, rarity: null };
        }
        if (blueShare < 0.38 && green / red < 0.75) {
            return { tier: 1, rarity: null };
        }
        return { tier: 0, rarity: null };
    }
    let rarity = null;
    if (blue > green + 8 && blue > red + 15) {
        rarity = "rare";
    } else if (red > green + 25 && blue > green + 25) {
        rarity = "heroic";
    } else if (green > blue + 30) {
        rarity = "common";
    }
    return { tier: 0, rarity };
}

function readSlot(image, frame, banks) {
    const top = frame.y + frame.h - FRAME_HEIGHT;
    const originX = frame.x + 21;
    const originY = top + 21;

    // Empty slot: hardly anything bright where a sprite would be.
    let bright = 0;
    for (let y = originY; y < originY + 72; y++) {
        for (let x = originX; x < originX + 72; x++) {
            if (y >= 0 && x >= 0 && y < image.height && x < image.width && image.brightest[y * image.width + x] > 65) {
                bright++;
            }
        }
    }
    if (bright < 15) {
        return null;
    }

    const gem = readGem(image, frame);
    const threshold = adaptiveThreshold(image, originX, originY, originX + 72, originY + 72);
    const rarityOf = id => {
        const item = allItems.find(candidate => candidate.id === id);
        return item ? item.rarity : null;
    };
    const bonus = gem.rarity ? (entry => (rarityOf(entry.id) === gem.rarity ? 0.04 : -0.04)) : null;
    const bankTier = gem.tier;
    let matches = matchSprite(image, banks.items[bankTier], originX, originY, threshold, bonus);

    // If the marker told us the wrong tier we get a poor match. Try the other
    // tiers too and keep whichever fits best.
    if (!matches[0] || matches[0].score < MIN_MATCH) {
        [0, 1, 2].filter(tier => tier !== bankTier).forEach(tier => {
            const other = matchSprite(image, banks.items[tier], originX, originY, threshold, bonus);
            if (other[0] && (!matches[0] || other[0].score > matches[0].score)) {
                matches = other;
            }
        });
    }
    return { gem, matches };
}

// ---------- Edge and oil icons ----------

function findIcons(image, region, banks) {
    const x0 = Math.max(0, Math.floor(region.x0));
    const y0 = Math.max(0, Math.floor(region.y0));
    const x1 = Math.min(image.width, Math.floor(region.x1));
    const y1 = Math.min(image.height, Math.floor(region.y1));
    if (x1 - x0 < 40 || y1 - y0 < 40) {
        return [];
    }
    const width = x1 - x0;
    const height = y1 - y0;
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y + y0) * image.width + (x + x0);
            mask[y * width + x] = image.brightest[i] > 90 && image.darkest[i] <= 140 ? 1 : 0;
        }
    }
    const padding = 7;
    const blobs = components(dilate(mask, width, height, padding), width, height);
    const hits = [];
    blobs.forEach(blob => {
        const blobWidth = blob.w - 2 * padding;
        const blobHeight = blob.h - 2 * padding;
        if (blobWidth < 30 || blobWidth > 95 || blobHeight < 30 || blobHeight > 95) {
            return;
        }
        const left = blob.x + padding + x0;
        const right = blob.x + blob.w - padding + x0;
        const top = blob.y + padding + y0;
        const bottom = blob.y + blob.h - padding + y0;
        const centerX = (left + right) >> 1;
        const centerY = (top + bottom) >> 1;
        const threshold = adaptiveThreshold(image, centerX - 36, centerY - 36, centerX + 36, centerY + 36);
        const match = matchSprite(image, banks.icons, centerX - 36, centerY - 36, threshold, null)[0];
        if (!match || match.score < MIN_ICON_MATCH) {
            return;
        }

        // Average colour of the lit pixels (used to tell the three oils apart).
        let count = 0, red = 0, green = 0, blue = 0;
        for (let y = top; y < bottom; y++) {
            for (let x = left; x < right; x++) {
                const i = y * image.width + x;
                if (image.brightest[i] > threshold) {
                    count++;
                    red += image.red[i];
                    green += image.green[i];
                    blue += image.blue[i];
                }
            }
        }
        hits.push({ x: centerX, entry: match.entry, score: match.score, red: red / count, green: green / count, blue: blue / count });
    });
    return hits.sort((a, b) => a.x - b.x);
}

function oilFromColour(hit) {
    const peak = Math.max(hit.red, hit.green, hit.blue) || 1;
    const r = hit.red / peak;
    const g = hit.green / peak;
    const b = hit.blue / peak;
    if (b > 0.9 && r < 0.7) {
        return "armor";
    }
    if (g > 0.65 && r > 0.9) {
        return "speed";
    }
    return "attack";
}

// ---------- Putting it all together ----------

function sizeCandidates(bitmap) {
    const list = [];
    if (Math.abs(bitmap.width / bitmap.height - 16 / 9) < 0.02) {
        list.push(bitmap.height / 1080);
    }
    [1, 2, 1.5, 4 / 3, 2 / 3, 0.5, 3, 0.75, 1.25, 2.5, 0.8].forEach(k => list.push(k));
    return list.filter((k, index) => list.findIndex(other => Math.abs(other - k) < 0.01) === index);
}

// Try a few sizes until the slot frames come out at the expected width.
function normaliseScreenshot(bitmap) {
    for (const k of sizeCandidates(bitmap)) {
        const width = Math.round(bitmap.width / k);
        const height = Math.round(bitmap.height / k);
        if (width < 300 || height < 300) {
            continue;
        }
        const image = preparePixels(renderBitmap(bitmap, width, height), width, height);
        const boxes = creamComponents(image);
        const { slots, centerX } = findSlots(boxes);
        if (slots.length >= 2) {
            return { image, boxes, slots, centerX };
        }
    }
    return null;
}

async function readScreenshot(bitmap) {
    const banks = await loadSpriteBanks();
    const found = normaliseScreenshot(bitmap);
    if (!found) {
        return { error: "Couldn't find any item slots in that picture. Use a screenshot of your build in the game." };
    }
    const { image, boxes, slots, centerX } = found;
    const notes = [];

    // Items
    const items = Array(12).fill(null);
    slots.slice(0, 12).forEach((frame, index) => {
        const slot = readSlot(image, frame, banks);
        if (!slot) {
            return;
        }
        const best = slot.matches[0];
        if (!best || best.score < MIN_MATCH) {
            notes.push("Slot " + (index + 1) + " wasn't recognised, so it was left empty.");
            return;
        }
        items[index] = { id: best.entry.id, tier: best.entry.tier };
        const runnerUp = slot.matches.find(match => match.entry.id !== best.entry.id);
        if (runnerUp && best.adjusted - runnerUp.adjusted < 0.03) {
            const other = allItems.find(candidate => candidate.id === runnerUp.entry.id);
            const chosen = allItems.find(candidate => candidate.id === best.entry.id);
            notes.push("Slot " + (index + 1) + " could be " + chosen.name + " or " + (other ? other.name : runnerUp.entry.id) + " (they look the same).");
        }
    });

    // Weapon
    let weaponId = null;
    let weaponStacks = 1;
    const weaponFrame = findWeaponFrame(image, centerX);
    if (weaponFrame) {
        const originX = weaponFrame.x + 20;
        const originY = weaponFrame.y + weaponFrame.h - FRAME_HEIGHT + 20;
        const threshold = adaptiveThreshold(image, originX, originY, originX + 72, originY + 72);
        const match = matchSprite(image, banks.weapons, originX, originY, threshold, null)[0];
        if (match && match.score >= MIN_MATCH) {
            weaponId = match.entry.id;
            if (weaponId === "hidden_dagger" && match.entry.tier > 1) {
                weaponStacks = match.entry.tier;
            }
        } else {
            notes.push("The weapon wasn't recognised.");
        }
    } else {
        notes.push("No weapon found in the picture.");
    }

    // Edge and oils. They show in the panel to the left of the weapon on the
    // game-over screen, or inside the tooltip you get by hovering the weapon.
    const regions = [];
    if (weaponFrame) {
        const bottom = weaponFrame.y + weaponFrame.h;
        regions.push({ x0: weaponFrame.x - 480, y0: bottom - FRAME_HEIGHT - 10, x1: weaponFrame.x - 10, y1: bottom + 10 });
    }
    boxes.filter(box => box.w >= 250 && box.w <= 900 && box.h >= 200 && box.h <= 900)
        .forEach(box => regions.push({ x0: box.x + 12, y0: box.y + 12, x1: box.x + box.w - 12, y1: box.y + box.h - 12 }));

    let hits = [];
    for (const region of regions) {
        hits = findIcons(image, region, banks);
        if (hits.length > 0) {
            break;
        }
    }
    let edgeId = null;
    let oils = { attack: true, armor: true, speed: true };
    if (hits.length > 0) {
        const edgeHit = hits.find(hit => hit.entry.kind === "edge");
        edgeId = edgeHit ? edgeHit.entry.id : null;
        oils = { attack: false, armor: false, speed: false };
        hits.filter(hit => hit.entry.kind === "oil").forEach(hit => {
            oils[oilFromColour(hit)] = true;
        });
    }

    return {
        build: { weapon: weaponId, weaponStacks, edge: edgeId, oils, items },
        foundIcons: hits.length > 0,
        notes
    };
}

// ---------- The page's buttons ----------

function showImportStatus(lines) {
    const status = document.getElementById("import-status");
    status.innerHTML = "";
    lines.forEach(line => {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        status.appendChild(paragraph);
    });
}

async function importScreenshotFile(file) {
    if (!file || !file.type.startsWith("image/")) {
        showImportStatus(["That file isn't an image."]);
        return;
    }
    showImportStatus(["Reading screenshot..."]);
    try {
        const bitmap = await createImageBitmap(file);
        const result = await readScreenshot(bitmap);
        if (result.error) {
            showImportStatus([result.error]);
            return;
        }
        applyBuild(result.build);
        const lines = ["Loaded " + result.build.items.filter(Boolean).length + " items from the screenshot."];
        if (!result.foundIcons) {
            lines.push("No edge or oil info in the picture, so it uses no edge and all three oils.");
        }
        showImportStatus(lines.concat(result.notes));
    } catch (error) {
        console.error(error);
        showImportStatus(["Something went wrong reading that screenshot."]);
    }
}

const screenshotInput = document.getElementById("screenshot-file");
document.getElementById("load-screenshot").addEventListener("click", () => screenshotInput.click());
screenshotInput.addEventListener("change", () => {
    importScreenshotFile(screenshotInput.files[0]);
    screenshotInput.value = "";
});

// Pasting (Ctrl+V) or dropping an image anywhere on the page works too.
document.addEventListener("paste", event => {
    const file = Array.from(event.clipboardData ? event.clipboardData.files : []).find(candidate => candidate.type.startsWith("image/"));
    if (file) {
        event.preventDefault();
        importScreenshotFile(file);
    }
});
document.addEventListener("dragover", event => event.preventDefault());
document.addEventListener("drop", event => {
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
        event.preventDefault();
        importScreenshotFile(file);
    }
});
