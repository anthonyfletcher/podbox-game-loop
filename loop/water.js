// water: the board as a cells field, and the liquids in it.
//
// The field is the whole screen, 160 x 120. Every pixel is a
// material whose number is its palette colour, so blitting the field
// draws the board: pipe walls (solid), the three liquids, the dots of the
// empty cells, and air, colour 0, whose palette entry is the background.
// cells.step moves the liquids under gravity: they fall, run level and
// rest, and resting liquid sleeps and costs next to nothing.
//
// Each pipe kind has its liquid -- water in the thick, oil in the twins,
// green in the thin -- of different weights, so a spill settles in layers.
// Each liquid is two materials, which behave alike and look alike.
//
// The inside of an empty pipe is HOLLOW, not air: unseen, static, and
// lighter than any liquid, so liquid pours through it as through air. Only
// liquid meeting the air outside the pipes becomes spill, so a sealed
// network, with no way out to the air, never loses what it holds.
//
// Liquid is poured into one piece at a time: the pour visits the pieces in
// reading order, a few ticks each, trickling into whichever of its pipes
// are not already sealed -- a few drops a tick at the top of the pipe's
// inside, which fall and run on from there. From there it runs through what that piece joins and out
// of the network's open ends, so an open network leaks where it is open
// and a sealed one fills and stays full. Liquid meeting the open air
// becomes spill, the same colours, which dries as it falls and as it rests
// on the board. Spill reaching the floor -- the field's bottom row -- or
// the pool on it becomes pool, which runs the whole width of the screen,
// under the column too, and dries only from its surface, slowly: the
// deeper the pool, the faster, so it settles a few pixels deep. The column keeps its text
// above the bottom POOL_ROWS rows, and shows the field only below them.
//
// What the game does to it:
//   lay()      a board's walls and dots; a network sealed from the start full
//   flick(c)   a turn begins: a flick of droplets off each opening
//   open(c)    the piece's walls go and its liquid is thrown out, and the
//              pipes either side pour out of the gap
//   close(c)   the turn ends: the walls go back as the piece now stands
//   pour(c)    a network sealed: trickled into a cell at a time from c,
//              slowly enough to watch it rise, then topped off
//   step()     a tick of the pour from the cursor (on the title, from the
//              tops of the L and the P), the pouring of sealed networks,
//              the bridges over crossings, and the field
//
// A crossing's second pipe runs over its first and cuts it in two, so
// liquid in the first would stop at the cut. Every other tick a bridge
// carries it across, a pixel a row (half the crossings one tick, half
// the next): down only where the pipe stands upright, and
// where it lies level, from a side with liquid two pixels deep at the cut
// to a side empty two pixels deep, so it never runs back and forth.

const W = 160, H = 120;
const POOL_ROWS = 6;                // the rows under the column the pool shows in
const AIR = 0, DOT = 2, PIPE = 5, HOLLOW = 12;
const LIQ = 16;                     // liquid k is LIQ + 2k and LIQ + 2k + 1
const POUR_GAP = 8;                 // ticks between a cell and the next
const CURSOR_TICKS = 100;           // ticks the pour runs after the cursor
                                    // arrives: about 3 s
const DROPS = 3;                    // drops a tick it trickles in
const TITLE_DROPS = 1;              // and each of the title's two
const TOP_ROWS = 10;                // drops land among a pipe's highest
                                    // this many inside pixels
const SPILL = 24;                   // spilt liquid k is SPILL + 2k, + 2k + 1
const DRY = 2;                      // spill's chance a tick, of 256, of drying
const FLOOR = 11;                   // the bottom row, unseen: where the pool starts
const POOL = 48;                    // pool k is POOL + 2k and POOL + 2k + 1
const POOL_DEPTH = 4;               // the pool's depth before it dries faster
const LEAK = 50;                    // liquid's chance a tick of becoming spill
                                    // where it meets the open air
const POUR_DROPS = 2;               // drops a tick into each pipe of a sealed
                                    // network being poured
const POUR_STILL = 8;               // ticks of no drop fitting: it is full
const POUR_MAX = 330;               // ticks a pour may take at most

var field;
var rules;
var splash;                         // what a turn throws, landing as liquid
var flicks;                         // droplets drawn only, never liquid
var ox = 4, oy = 1;                 // the board's top left in the field
var pourAt = new Int32Array(128);   // the tick a node is poured into; -1
var feed = -1;                      // the cell the cursor's pour is at
var feedT = 0;                      // ticks it has been there
var pouring = 0;                    // 1 while a sealed network is poured
var pourStart = 0, pourStill = 0;
var topping = 64;                    // the cell the top-off has reached; 64 done
const TOP_PER_TICK = 8;
var moved = 0;                      // cells that moved last step
var box = new Int32Array(4);        // what a step changed, from cells.step
var dx0 = 0, dy0 = 0, dx1 = W - 1, dy1 = H - 1;   // what changed since the
                                    // screen was drawn; dx1 -1 for nothing
var awake = 1;                      // ticks of stepping owed; 0 asleep
const SETTLE = 3;                   // still steps before the field sleeps
var depth = new Int32Array(128);
var evaporating = new Int32Array(6);   // the pool's drying reactions
// The inside of each piece's pipes, read from pipes.png the first time a
// piece is poured into at that turn: (kind * 4 + turns) * 2 + slot holds
// the inside pixels as y * 14 + x, highest first.
var insides = [];
var queue = new Int32Array(128);
var crossings = new Int32Array(64); // the board's crossings
var crossN = 0;
// Per kind * 4 + turns, built the first time it is needed: each row (or
// column) of a crossing's first pipe as eight numbers in the cell, x, y
// of the pixel before the cut, of the pixel after it, and of the pixels
// behind those; the behinds are -1 where the pipe stands upright, and
// the liquid crosses only downward. Level, the rows run bottom up.
var bridges = [];
// crossing q's rows in the field, rowN[q] of them from q * 64, set as it
// is laid and as it turns, and its cell's top left
var rows = new Int32Array(64 * 64), rowN = new Int32Array(64);
var crossX = new Int32Array(64), crossY = new Int32Array(64);
var half = 0;                       // the crossings bridged this tick: q & 1
var pbox = new Int32Array(4);       // the box of the step before last

function setup() {
    field = img(W, H);
    rules = cells.rules();
    solid(PIPE); solid(DOT); solid(FLOOR);
    rules.move[HOLLOW] = MOVE.STATIC;
    rules.density[HOLLOW] = 1;
    liquid(0, 100);                 // water
    liquid(1, 85);                  // oil: floats on water
    liquid(2, 115);                 // green: sinks under it
    // liquid meeting open air becomes spill, which dries as it falls and rests
    var k = 0;
    for (var r = 0; r < 6; r++) {
        var sm = SPILL + r, lm = LIQ + r;
        rules.move[sm] = MOVE.LIQUID;
        rules.density[sm] = rules.density[lm];
        rules.spread[sm] = 4;
        rules.decay[sm] = DRY;
        rules.becomes[sm] = AIR;
        rules.a[k] = lm; rules.b[k] = AIR; rules.c[k] = sm; rules.d[k] = AIR; rules.chance[k] = LEAK; k++;
    }
    // spill on the floor, or on the pool, joins the pool; the pool's
    // surface dries (evaporating, set by depth in step)
    for (var r2 = 0; r2 < 6; r2++) {
        var pm = POOL + r2;
        rules.move[pm] = MOVE.LIQUID;
        rules.density[pm] = rules.density[LIQ + r2];
        rules.spread[pm] = 4;
        rules.a[k] = SPILL + r2; rules.b[k] = FLOOR; rules.c[k] = pm; rules.d[k] = FLOOR; rules.chance[k] = 255; k++;
        for (var j = 0; j < 6; j++) {
            rules.a[k] = SPILL + r2; rules.b[k] = POOL + j; rules.c[k] = pm; rules.d[k] = POOL + j; rules.chance[k] = 255; k++;
        }
        evaporating[r2] = k;
        rules.a[k] = pm; rules.b[k] = AIR; rules.c[k] = AIR; rules.d[k] = AIR; rules.chance[k] = 1; k++;
    }
    splash = particles.pool(160);
    splash.gravity = 0.12;
    splash.field = field;
    flicks = particles.pool(48);
    flicks.gravity = 0.1;
    for (var q = 0; q < 18 * 4 * 2; q++) insides.push(null);
    for (var q2 = 0; q2 < 18 * 4; q2++) bridges.push(null);
    fill(pourAt, -1);
}

// adds a rectangle of the field to what the next frame draws again
function dirty(x0, y0, x1, y1) {
    if (dx1 < 0) { dx0 = x0; dy0 = y0; dx1 = x1; dy1 = y1; return; }
    dx0 = min(dx0, x0); dy0 = min(dy0, y0);
    dx1 = max(dx1, x1); dy1 = max(dy1, y1);
}

function inside(k, r, s) {
    var key = (k * 4 + r) * 2 + s;
    if (insides[key] != null) return insides[key];
    var n = tiles.frameOf(k, r), sx = (n % 16) * 8 + 1, sy = flr(n / 16) * 8 + 1;
    var a = [], b = [];
    sheet(IMG.pipes);
    for (var y = 0; y < 14; y++)
        for (var x = 0; x < 14; x++) {
            var c = sget(sx + x, sy + y);
            if (c == 32) a.push(y * 14 + x);
            else if (c == 40) b.push(y * 14 + x);
        }
    sheet();
    insides[(k * 4 + r) * 2] = a;
    insides[(k * 4 + r) * 2 + 1] = b;
    return s == 0 ? a : b;
}

// Air inside cell c's pipe in slot s made hollow. A network sealing can
// hold air that leaked in while it was open, and its liquid would turn
// to spill against it and dry; sealed, no air can come back in.
function unair(c, s) {
    var list = inside(board.kind[c], board.turns[c], s);
    var x0 = ox + (c % 8) * 14, y0 = oy + flr(c / 8) * 14;
    target(field);
    for (var i = 0; i < list.length; i++) {
        var x = x0 + list[i] % 14, y = y0 + flr(list[i] / 14);
        if (pget(x, y) == AIR) pset(x, y, HOLLOW);
    }
    target(SCREEN);
}

// a few drops of its liquid into the top of cell c's pipe in slot s,
// where the field has air or hollow; returns how many went in
function trickle(c, s, drops) {
    var ch = board.chan[c * 2 + s];
    if (ch < 0) return 0;
    var list = inside(board.kind[c], board.turns[c], s);
    if (list.length == 0) return 0;
    var want = drops;
    var x0 = ox + (c % 8) * 14, y0 = oy + flr(c / 8) * 14;
    var top = min(TOP_ROWS, list.length);
    target(field);
    for (var i = 0; i < drops * 2 && drops > 0; i++) {
        var p = list[rnd(top)], x = x0 + p % 14, y = y0 + flr(p / 14);
        var m = pget(x, y);
        if (m == AIR || m == HOLLOW) {
            pset(x, y, LIQ + ch * 2 + rnd(2));
            drops--;
        }
    }
    target(SCREEN);
    awake = SETTLE;
    return want - drops;
}

// Once a second: the pool's depth, sampled across the screen, sets how
// fast its surface dries -- barely at all up to POOL_DEPTH, then faster
// the deeper it is, so it never climbs far up the board.
function evaporate() {
    var deep = 0;
    target(field);
    for (var x = 8; x < W; x += 16) {
        var d = 0;
        while (d < 20 && pget(x, H - 2 - d) >= POOL && pget(x, H - 2 - d) < POOL + 6) d++;
        deep = max(deep, d);
    }
    target(SCREEN);
    var chance = deep <= POOL_DEPTH ? 1 : min(255, (deep - POOL_DEPTH) * 40);
    for (var r = 0; r < 6; r++) rules.chance[evaporating[r]] = chance;
}

function solid(m) { rules.move[m] = MOVE.STATIC; rules.density[m] = 255; }

function liquid(k, weight) {
    for (var s = 0; s < 2; s++) {
        var m = LIQ + k * 2 + s;
        rules.move[m] = MOVE.LIQUID;
        rules.density[m] = weight;
        rules.spread[m] = 4;
    }
}

function reduced() { return opt.get(OPT.water) == 1; }

// ---- stamping pieces into the field --------------------------------------------

// Draws cell c's piece into the field: with walls 1, its walls, and the
// insides of the slots not in fills as hollow; and the insides of the
// slots in fills (bit s for slot s) as liquid. Without walls, every other
// part of the frame is left as the field has it.
function stamp(c, walls, fills) {
    var k = board.kind[c];
    if (k < 0) return;
    target(field);
    sheet(IMG.pipes);
    if (!walls) palt(PIPE, true);
    for (var s = 0; s < 2; s++) {
        var base = 32 + s * 8, ch = board.chan[c * 2 + s];
        if ((fills & (1 << s)) != 0 && ch >= 0) {
            pal(base, LIQ + ch * 2);
        } else if (walls) {
            pal(base, HOLLOW);
        } else {
            palt(base, true);
        }
    }
    spr(tiles.frameOf(k, board.turns[c]), ox + (c % 8) * 14 - 1, oy + flr(c / 8) * 14 - 1, 2, 2);
    pal();
    palt();
    sheet();
    target(SCREEN);
    awake = SETTLE;
}

// The whole board afresh: walls and dots, the pipes empty but for any
// network sealed from the start, which is full. The pour round the board
// starts at the first piece.
function lay() {
    target(field);
    cls(AIR);
    line(0, H - 1, W - 1, H - 1, FLOOR);
    for (var c = 0; c < 64; c++)
        if (board.kind[c] < 0) pset(ox + (c % 8) * 14 + 6, oy + flr(c / 8) * 14 + 6, DOT);
    target(SCREEN);
    for (var c2 = 0; c2 < 64; c2++)
        stamp(c2, 1, (board.sealed[c2 * 2] ? 1 : 0) | (board.sealed[c2 * 2 + 1] ? 2 : 0));
    crossN = 0;
    for (var c3 = 0; c3 < 64; c3++)
        if (board.kind[c3] >= 12 && (board.kind[c3] & 1) == 0) {
            crossings[crossN] = c3;
            span(crossN++);
        }
    feed = -1;
    feedT = 0;
    fill(pourAt, -1);
    pouring = 0;
    topping = 64;
    fill(splash.life, 0);
    fill(flicks.life, 0);
    awake = SETTLE;
}

// ---- turns -------------------------------------------------------------------------

// A turn begins: the piece's liquid is thrown out, falling back as
// liquid where it lands (or, with reduced effects, just let fall), and
// then the piece -- walls and hollow -- leaves the field as air. The
// board already holds the piece turned, so it is found a quarter back.
function open(c) {
    var k = board.kind[c];
    cells.lift(field, rules, ox + (c % 8) * 14 + 7, oy + flr(c / 8) * 14 + 7, 7, splash,
               reduced() ? 0.3 : 1.3);
    target(field);
    sheet(IMG.pipes);
    pal(PIPE, AIR);
    pal(32, AIR); pal(40, AIR);
    spr(tiles.frameOf(k, (board.turns[c] + 3) & 3), ox + (c % 8) * 14 - 1, oy + flr(c / 8) * 14 - 1, 2, 2);
    pal();
    sheet();
    target(SCREEN);
    awake = SETTLE;
}

// Droplets off each opening of cell c's pipes, in each pipe's liquid,
// thrown the way the piece turns. Read before the turn: the openings as
// the piece stands.
function flick(c) {
    var x = ox + (c % 8) * 14 + 7, y = oy + flr(c / 8) * 14 + 7;
    var each = reduced() ? 1 : 3;
    for (var s = 0; s < 2; s++) {
        var n = c * 2 + s, m = board.mask[n], ch = board.chan[n];
        if (ch < 0) continue;
        for (var i = 0; i < 4; i++) {
            if ((m & board.BIT[i]) == 0) continue;
            var dx = board.DX[i], dy = board.DY[i];
            // clockwise round the piece, and a little outward
            particles.emit(flicks, each, x + dx * 7, y + dy * 7,
                           -dy * 1.2 + dx * 0.5, dx * 1.2 + dy * 0.5 - 0.4,
                           0.45, 16, LIQ + ch * 2 + (i & 1));
        }
    }
}

// the turn ends: the walls as the piece now stands, hollow inside
function close(c) {
    stamp(c, 1, 0);
    for (var q = 0; q < crossN; q++)
        if (crossings[q] == c) span(q);
}

// After the analysis: pours into every node of a network that sealed,
// a cell at a time outward from cell c (or, with c -1, from each sealed
// network's first node). Returns whether any did.
function pour(c) {
    var sealed = board.sealed, mask = board.mask, across = board.across;
    var head = 0, tail = 0;
    fill(depth, -1);
    if (c >= 0) {
        for (var s = 0; s < 2; s++) {
            var n = c * 2 + s;
            if (sealed[n]) { depth[n] = 0; queue[tail++] = n; }
        }
    } else {
        for (var q0 = 0; q0 < board.liveN; q0++) {
            var n0 = board.live[q0];
            if (sealed[n0]) { depth[n0] = 0; queue[tail++] = n0; }
        }
    }
    while (head < tail) {
        var a = queue[head++], ms = mask[a];
        for (var i = 0; i < 4; i++) {
            if ((ms & board.BIT[i]) == 0) continue;
            var b = across[a * 4 + i];
            if (b < 0 || depth[b] >= 0 || !sealed[b] || (mask[b] & board.BACK[i]) == 0) continue;
            depth[b] = depth[a] + 1;
            queue[tail++] = b;
        }
    }
    var now = frame();
    for (var q = 0; q < tail; q++) {
        var nn = queue[q];
        pourAt[nn] = now + depth[nn] * POUR_GAP;
    }
    if (tail > 0) {
        pouring = 1;
        pourStart = now;
        pourStill = 0;
    }
    return tail > 0;
}

// A tick: the pouring, the splash and the field. cells.step reports the
// box round what changed since the last step, and the boxes are added up
// until the screen is drawn (tiles.drawChanged); what is drawn into the
// field is in the next step's box too.
// A tick of the pour into cell c's pipes that are not sealed, unless it
// is turning
function pourInto(c) {
    if (c == spin) return;
    for (var s = 0; s < 2; s++) {
        var n = c * 2 + s;
        if (board.chan[n] >= 0 && !board.sealed[n]) trickle(c, s, state == TITLE ? TITLE_DROPS : DROPS);
    }
}

function bridge(k, r) {
    var key = k * 4 + r;
    if (bridges[key] != null) return bridges[key];
    var list = inside(k, r, 0), level = (r & 1) == 0, out = [];
    for (var j = 13; j >= 0; j--) {
        var lo = -1, hi = 14;       // the last pixel before the cut, the first after
        for (var i = 0; i < list.length; i++) {
            var x = list[i] % 14, y = flr(list[i] / 14);
            var u = level ? x : y;
            if ((level ? y : x) != j) continue;
            if (u < 7) lo = max(lo, u); else hi = min(hi, u);
        }
        if (lo < 1 || hi > 12) continue;
        if (level) out.push(lo, j, hi, j, lo - 1, j, hi + 1, j);
        else out.push(j, lo, j, hi, -1, -1, -1, -1);
    }
    bridges[key] = out;
    return out;
}

// crossing q's rows, as its piece now stands
function span(q) {
    var c = crossings[q], b = bridge(board.kind[c], board.turns[c]);
    var x0 = ox + (c % 8) * 14, y0 = oy + flr(c / 8) * 14;
    crossX[q] = x0; crossY[q] = y0;
    rowN[q] = b.length;
    for (var i = 0; i < b.length; i += 2) {
        rows[q * 64 + i] = b[i] < 0 ? -1 : x0 + b[i];
        rows[q * 64 + i + 1] = b[i + 1] < 0 ? -1 : y0 + b[i + 1];
    }
}

// A tick of half the bridges, those in the box the last two steps
// changed (a bridge outside it is as it was, and carried nothing);
// returns whether any carried liquid. A pixel m is the crossing's liquid when m >> 1 is h,
// and empty when m is air or hollow. A level row with no liquid at the
// cut has none in the rows of its lane above it either.
function cross() {
    var any = 0, gx0 = box[0], gy0 = box[1], gx1 = box[2], gy1 = box[3];
    if (gx0 < 0) { gx0 = pbox[0]; gy0 = pbox[1]; gx1 = pbox[2]; gy1 = pbox[3]; }
    else if (pbox[0] >= 0) {
        gx0 = min(gx0, pbox[0]); gy0 = min(gy0, pbox[1]);
        gx1 = max(gx1, pbox[2]); gy1 = max(gy1, pbox[3]);
    }
    half = 1 - half;
    target(field);
    for (var q = half; q < crossN; q += 2) {
        var x0 = crossX[q], y0 = crossY[q];
        if (x0 > gx1 || x0 + 13 < gx0 || y0 > gy1 || y0 + 13 < gy0) continue;
        var c = crossings[q];
        if (c == spin || board.sealed[c * 2]) continue;
        var h = (LIQ >> 1) + board.chan[c * 2], end = q * 64 + rowN[q], dry = -1;
        for (var i = q * 64; i < end; i += 8) {
            var ax = rows[i], ay = rows[i + 1], bx = rows[i + 2], by = rows[i + 3];
            var ex = rows[i + 4], a, d, f;
            if (ex < 0) {
                a = pget(ax, ay);
                if (a >> 1 != h) continue;
                d = pget(bx, by);
                if (d == HOLLOW || d == AIR) { pset(bx, by, a); pset(ax, ay, HOLLOW); any = 1; }
                continue;
            }
            if (ay == dry) { dry--; continue; }
            a = pget(ax, ay); d = pget(bx, by);
            if (a >> 1 == h) {
                if ((d == HOLLOW || d == AIR) && pget(ex, rows[i + 5]) >> 1 == h) {
                    f = pget(rows[i + 6], rows[i + 7]);
                    if (f == HOLLOW || f == AIR) { pset(bx, by, a); pset(ax, ay, HOLLOW); any = 1; }
                }
            } else if (d >> 1 == h) {
                if ((a == HOLLOW || a == AIR) && pget(rows[i + 6], rows[i + 7]) >> 1 == h) {
                    f = pget(ex, rows[i + 5]);
                    if (f == HOLLOW || f == AIR) { pset(ax, ay, d); pset(bx, by, HOLLOW); any = 1; }
                }
            } else {
                dry = ay - 1;
            }
        }
    }
    target(SCREEN);
    return any;
}

function step() {
    // Pouring a sealed network: each of its pipes, from its turn on, takes
    // a few drops a tick at its top until no more fit -- the network is
    // full to the top -- and then the top-off fills what pockets are left.
    if (pouring) {
        var now = frame(), placed = 0, waiting = 0;
        for (var c = 0; c < 64; c++) {
            for (var s = 0; s < 2; s++) {
                var at = pourAt[c * 2 + s];
                if (at < 0) continue;
                if (now < at) waiting = 1;
                else {
                    if (now == at) unair(c, s);
                    placed += trickle(c, s, POUR_DROPS);
                }
            }
        }
        pourStill = placed > 0 || waiting ? 0 : pourStill + 1;
        if (pourStill >= POUR_STILL || now - pourStart > POUR_MAX) {
            pouring = 0;
            topping = 0;
        }
    }
    // A pour leaves pockets of air, and liquid beside air never quite
    // rests, so the field could not sleep: once the pour is done each
    // poured cell is filled again, a few a tick.
    if (topping < 64) {
        for (var n = 0; n < TOP_PER_TICK && topping < 64; topping++) {
            var c2 = topping, f2 = 0;
            if (pourAt[c2 * 2] >= 0 && board.sealed[c2 * 2]) f2 |= 1;
            if (pourAt[c2 * 2 + 1] >= 0 && board.sealed[c2 * 2 + 1]) f2 |= 2;
            if (f2) { stamp(c2, 0, f2); n++; }
        }
        if (topping >= 64) fill(pourAt, -1);
    }
    particles.step(splash);
    particles.step(flicks);
    if (frame() % 33 == 0) evaporate();
    // The pour: in play, into the cursor's piece for CURSOR_TICKS after it
    // arrives or turns; on the title, into the tops of the L and the P.
    if (state == PLAY) {
        if (cur != feed || spin >= 0) { feed = cur; feedT = 0; }
        if (feedT < CURSOR_TICKS) { feedT++; pourInto(feed); }
    } else if (state == TITLE) {
        for (var i = 0; i < TITLE_POURS.length; i++) pourInto(TITLE_POURS[i]);
    }
    // A field that has been still for SETTLE steps sleeps, and costs
    // nothing, until something is drawn into it or a splash is falling.
    if (awake == 0 && particles.bounds(splash, tiles.box) == 0) return;
    // on a slow player the field moves every other tick: the water at
    // half speed rather than the game falling behind
    if (slow && (frame() & 1)) return;
    if (crossN > 0 && (box[0] >= 0 || pbox[0] >= 0) && cross()) awake = SETTLE;
    for (var b = 0; b < 4; b++) pbox[b] = box[b];
    fill(box, -1);
    moved = cells.step(field, 0, rules, null, box);
    if (box[0] >= 0) dirty(box[0], box[1], box[2], box[3]);
    if (moved > 0) {
        awake = SETTLE;
    } else if (awake > 0) {
        awake--;
    }
}
