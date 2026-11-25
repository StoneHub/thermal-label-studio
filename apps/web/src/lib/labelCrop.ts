import { normalizeCrop, type CropRect } from "./imageCrop";

/** Quarter turns clockwise, as the label editor stores them. */
export type QuarterTurn = 0 | 90 | 180 | 270;
export interface PixelBox { left: number; top: number; right: number; bottom: number }
export interface BarcodeHit {
  box: PixelBox;
  /** True for one-dimensional (bar) codes such as Code 128; false for QR codes. */
  linear: boolean;
  /** Clockwise turn that makes the code read left to right, when the decoder knows it. */
  turn: QuarterTurn | null;
}
export interface FoundShippingLabel {
  /** Normalized crop around the label, with a thin white margin. */
  crop: CropRect;
  /** Clockwise turn that stands the label upright. */
  rotation: QuarterTurn;
  /** How many bar codes the label holds. */
  barcodes: number;
  /** True when the turn came from reading the bar codes, not from the label's shape. */
  rotationFromBarcodes: boolean;
}

/** Pixels darker than this count as ink. */
const INK = 160;

/**
 * Find a shipping label on a page image and say how to turn it upright.
 *
 * Shipping labels are the part of a page that holds bar codes, so the search
 * starts from the bar codes a decoder found. Return pages often fence the label
 * with a dashed cut box: dashed rows split the page into bands, the label's band
 * is the one holding the most bar code area, and dashed columns inside that band
 * close the box. A label fenced by cut lines is everything inside them, because
 * its address block can sit apart from the bar codes in white space. Without cut
 * lines the label is the connected block of ink around the bar codes, which
 * skips white margins and text that sits apart from it. The decoder reports which way each bar code
 * reads, and a label's bar codes read the same way as its text, so a weighted
 * vote gives the turn. Without that, a landscape box on a portrait 4x6 label
 * is most likely a quarter turn.
 */
export function locateShippingLabel(gray: Uint8Array, width: number, height: number, hits: BarcodeHit[]): FoundShippingLabel | null {
  const linear = hits.filter(hit => hit.linear && hit.box.right > hit.box.left && hit.box.bottom > hit.box.top);
  if (!linear.length || width < 8 || height < 8) return null;
  const rows = findDashedLines(gray, width, height, "rows");
  const band = bestRegion(splits(rows, height), [[0, width]], linear);
  // Cut boxes have short sides, so dashed columns are measured within the band.
  const columns = findDashedLines(gray, width, height, "columns", band);
  const region = bestRegion([[band.top, band.bottom]], splits(columns, width), linear);
  const anchors = linear.filter(hit => inside(center(hit.box), region));
  // Cut lines are left out of the label, with a couple of pixels either side for their soft edges.
  const widen = (lines: number[]) => new Set(lines.flatMap(line => [line - 2, line - 1, line, line + 1, line + 2]));
  const skipRows = widen(rows), skipColumns = widen(columns);
  const fenced = region.top > 0 && region.bottom < height;
  const block = fenced
    ? inkBounds(gray, width, cutSpan(gray, width, region), skipRows, skipColumns) ?? inkBlock(gray, width, height, region, anchors, skipRows, skipColumns)
    : inkBlock(gray, width, height, region, anchors, skipRows, skipColumns);
  const margin = Math.max(2, Math.round(Math.max(width, height) * .006));
  const box = {
    left: Math.max(region.left, block.left - margin), top: Math.max(region.top, block.top - margin),
    right: Math.min(region.right, block.right + margin), bottom: Math.min(region.bottom, block.bottom + margin),
  };
  const { turn, fromBarcodes } = voteTurn(anchors, box);
  return {
    crop: normalizeCrop({ x: box.left / width, y: box.top / height,
      width: (box.right - box.left) / width, height: (box.bottom - box.top) / height }),
    rotation: turn,
    barcodes: anchors.length,
    rotationFromBarcodes: fromBarcodes,
  };
}

/**
 * Rows (or columns) that form a thin dashed line across most of the area
 * (the whole page unless given). Text lines also break into many short runs,
 * so a dashed line must also be thin, with clear space on both sides, and its
 * dashes and gaps must be short and even. Returns page coordinates.
 */
export function findDashedLines(gray: Uint8Array, width: number, height: number, axis: "rows" | "columns",
  area: PixelBox = { left: 0, top: 0, right: width, bottom: height }): number[] {
  const rowsAxis = axis === "rows";
  const length = rowsAxis ? area.right - area.left : area.bottom - area.top;
  const count = rowsAxis ? area.bottom - area.top : area.right - area.left;
  const offset = rowsAxis ? area.top : area.left;
  if (length < 1 || count < 1) return [];
  const at = rowsAxis ? (line: number, index: number) => gray[(area.top + line) * width + area.left + index]
    : (line: number, index: number) => gray[(area.top + index) * width + area.left + line];
  const ink = new Int32Array(count);
  const dashed = new Uint8Array(count);
  for (let line = 0; line < count; line += 1) {
    // Runs of ink and the gaps between them; a dashed line has even dashes and even gaps.
    let runs = 0, dark = 0, first = -1, last = -1, longest = 0, run = 0, gap = 0;
    let runSum = 0, runSquares = 0, gapSum = 0, gapSquares = 0, gaps = 0;
    for (let index = 0; index <= length; index += 1) {
      if (index < length && at(line, index) < INK) {
        if (run === 0) {
          runs += 1;
          if (first >= 0) { gaps += 1; gapSum += gap; gapSquares += gap * gap; }
        }
        run += 1; dark += 1; last = index; gap = 0;
        if (first < 0) first = index;
      } else {
        if (run > 0) { longest = Math.max(longest, run); runSum += run; runSquares += run * run; }
        run = 0; gap += 1;
      }
    }
    ink[line] = dark;
    const span = last - first + 1;
    dashed[line] = Number(first >= 0 && span >= length * .5 && runs >= 12 && dark >= span * .15 && dark <= span * .85
      && longest <= Math.max(4, length * .03) && even(runSum, runSquares, runs) && even(gapSum, gapSquares, gaps));
  }
  const thin = Math.max(2, Math.round(count * .003));
  const clear = Math.max(2, Math.round(count * .004));
  const lines: number[] = [];
  for (let start = 0; start < count;) {
    if (!dashed[start]) { start += 1; continue; }
    let end = start;
    while (end + 1 < count && dashed[end + 1]) end += 1;
    const before = start - clear, after = end + clear;
    const peak = Math.max(...ink.subarray(start, end + 1));
    const quiet = (line: number) => line < 0 || line >= count || ink[line] < peak * .2;
    if (end - start + 1 <= thin && quiet(before) && quiet(after)) {
      for (let line = start; line <= end; line += 1) lines.push(offset + line);
    }
    start = end + 1;
  }
  return lines;
}

/** True when values with this sum and sum of squares vary by less than half their mean. */
function even(sum: number, squares: number, count: number): boolean {
  if (count < 2) return false;
  const mean = sum / count;
  return Math.sqrt(Math.max(0, squares / count - mean * mean)) <= mean * .5;
}

/** Turn separator lines into the [start, end) spans between them. */
function splits(lines: number[], size: number): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = 0;
  for (const line of [...lines, size]) {
    if (line > start) spans.push([start, line]);
    start = line + 1;
  }
  return spans.length ? spans : [[0, size]];
}

function bestRegion(rows: Array<[number, number]>, columns: Array<[number, number]>, hits: BarcodeHit[]): PixelBox {
  let best: PixelBox = { left: 0, top: 0, right: columns[columns.length - 1][1], bottom: rows[rows.length - 1][1] };
  let bestArea = -1;
  for (const [top, bottom] of rows) for (const [left, right] of columns) {
    const region = { left, top, right, bottom };
    const area = hits.filter(hit => inside(center(hit.box), region)).reduce((sum, hit) => sum + boxArea(hit.box), 0);
    if (area > bestArea) { best = region; bestArea = area; }
  }
  return best;
}

/** The left and right ends of the dashed rows just above and below a fenced region, as the area to search. */
function cutSpan(gray: Uint8Array, width: number, region: PixelBox): PixelBox {
  let left = region.right, right = region.left;
  for (const y of [region.top - 1, region.bottom]) {
    for (let x = region.left; x < region.right; x += 1) {
      if (gray[y * width + x] < INK) { left = Math.min(left, x); right = Math.max(right, x + 1); }
    }
  }
  return right > left ? { ...region, left, right } : region;
}

/** The bounding box of all ink in an area, leaving out cut lines. */
function inkBounds(gray: Uint8Array, width: number, area: PixelBox, skipRows: Set<number>, skipColumns: Set<number>): PixelBox | null {
  let left = area.right, right = area.left, top = area.bottom, bottom = area.top;
  for (let y = area.top; y < area.bottom; y += 1) {
    if (skipRows.has(y)) continue;
    for (let x = area.left; x < area.right; x += 1) {
      if (skipColumns.has(x) || gray[y * width + x] >= INK) continue;
      if (x < left) left = x;
      if (x >= right) right = x + 1;
      if (y < top) top = y;
      bottom = y + 1;
    }
  }
  return right > left ? { left, top, right, bottom } : null;
}

/**
 * The bounding box of the ink connected to the bar codes. Ink is gathered into
 * small cells and grown by a gap of about a tenth of an inch on a letter page,
 * so letters, boxes and bars of one label join while separate blocks do not.
 */
function inkBlock(gray: Uint8Array, width: number, height: number, region: PixelBox, anchors: BarcodeHit[],
  skipRows: Set<number>, skipColumns: Set<number>): PixelBox {
  const cell = Math.max(2, Math.round(Math.max(width, height) / 400));
  const cols = Math.ceil((region.right - region.left) / cell);
  const rowsCount = Math.ceil((region.bottom - region.top) / cell);
  const inked = new Uint8Array(cols * rowsCount);
  for (let y = region.top; y < region.bottom; y += 1) {
    if (skipRows.has(y)) continue;
    const row = Math.floor((y - region.top) / cell) * cols;
    for (let x = region.left; x < region.right; x += 1) {
      if (!skipColumns.has(x) && gray[y * width + x] < INK) inked[row + Math.floor((x - region.left) / cell)] = 1;
    }
  }
  const reach = Math.max(1, Math.ceil(Math.max(width, height) * .008 / cell));
  const grown = dilate(inked, cols, rowsCount, reach);
  const seen = new Uint8Array(cols * rowsCount);
  const queue: number[] = [];
  for (const hit of anchors) {
    const left = clampCell((hit.box.left - region.left) / cell, cols), right = clampCell((hit.box.right - region.left) / cell, cols);
    const top = clampCell((hit.box.top - region.top) / cell, rowsCount), bottom = clampCell((hit.box.bottom - region.top) / cell, rowsCount);
    for (let row = top; row <= bottom; row += 1) for (let col = left; col <= right; col += 1) {
      const index = row * cols + col;
      if (grown[index] && !seen[index]) { seen[index] = 1; queue.push(index); }
    }
  }
  let minCol = cols, maxCol = -1, minRow = rowsCount, maxRow = -1;
  while (queue.length) {
    const index = queue.pop()!;
    const row = Math.floor(index / cols), col = index % cols;
    if (inked[index]) {
      minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextCol = col + dx, nextRow = row + dy;
      if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= rowsCount) continue;
      const next = nextRow * cols + nextCol;
      if (grown[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
    }
  }
  if (maxCol < 0) return unionBoxes(anchors.map(hit => hit.box));
  return {
    left: region.left + minCol * cell, top: region.top + minRow * cell,
    right: Math.min(region.right, region.left + (maxCol + 1) * cell), bottom: Math.min(region.bottom, region.top + (maxRow + 1) * cell),
  };
}

/** Square dilation done as two one-dimensional passes. */
function dilate(cells: Uint8Array, cols: number, rows: number, reach: number): Uint8Array {
  const across = new Uint8Array(cells.length);
  for (let row = 0; row < rows; row += 1) {
    let last = -Infinity;
    for (let col = 0; col < cols; col += 1) if (cells[row * cols + col]) last = col; else if (col - last <= reach) across[row * cols + col] = 1;
    last = Infinity;
    for (let col = cols - 1; col >= 0; col -= 1) {
      const index = row * cols + col;
      if (cells[index]) { last = col; across[index] = 1; } else if (last - col <= reach) across[index] = 1;
    }
  }
  const out = new Uint8Array(cells.length);
  for (let col = 0; col < cols; col += 1) {
    let last = -Infinity;
    for (let row = 0; row < rows; row += 1) if (across[row * cols + col]) last = row; else if (row - last <= reach) out[row * cols + col] = 1;
    last = Infinity;
    for (let row = rows - 1; row >= 0; row -= 1) {
      const index = row * cols + col;
      if (across[index]) { last = row; out[index] = 1; } else if (last - row <= reach) out[index] = 1;
    }
  }
  return out;
}

function voteTurn(hits: BarcodeHit[], box: PixelBox): { turn: QuarterTurn; fromBarcodes: boolean } {
  const votes = new Map<QuarterTurn, number>();
  for (const hit of hits) {
    if (hit.turn === null) continue;
    const weight = Math.max(hit.box.right - hit.box.left, hit.box.bottom - hit.box.top);
    votes.set(hit.turn, (votes.get(hit.turn) ?? 0) + weight);
  }
  let turn: QuarterTurn | null = null, best = 0;
  for (const [candidate, weight] of votes) if (weight > best) { turn = candidate; best = weight; }
  if (turn !== null) return { turn, fromBarcodes: true };
  return { turn: box.right - box.left > box.bottom - box.top ? 90 : 0, fromBarcodes: false };
}

const center = (box: PixelBox) => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });
const inside = (point: { x: number; y: number }, box: PixelBox) => point.x >= box.left && point.x < box.right && point.y >= box.top && point.y < box.bottom;
const boxArea = (box: PixelBox) => Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
const clampCell = (value: number, size: number) => Math.min(size - 1, Math.max(0, Math.floor(value)));
const unionBoxes = (boxes: PixelBox[]): PixelBox => ({
  left: Math.min(...boxes.map(box => box.left)), top: Math.min(...boxes.map(box => box.top)),
  right: Math.max(...boxes.map(box => box.right)), bottom: Math.max(...boxes.map(box => box.bottom)),
});
