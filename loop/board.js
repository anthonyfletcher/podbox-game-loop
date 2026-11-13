// board: the puzzle -- the pieces, a level laid on the 8 x 8 board,
// turning a piece, and which joints meet.
//
// A cell holds one piece: a kind (0-17) and its quarter turns clockwise
// (0-3). A piece carries one or two channels, each in a slot; a node is
// one slot of one cell, numbered cell * 2 + slot. A node's openings are
// four bits, UP 1, RIGHT 2, DOWN 4, LEFT 8, and opening i is bit 1 << i.
//
// The kinds, in the order of images/pipes.png:
//   0-3   channel 0: straight, corner, T, cross
//   4-7   channel 1: the same
//   8-11  channel 2: the same
//   12-17 two channels each, as pairs 0+1, 1+2, 0+2: a crossing (first
//         left-right, second up-down) and a twin corner (first right to
//         bottom, second left to top)
//
// analyse() is the sealing test: every opening must meet an opening of
// the same channel coming back from the next cell. It also groups nodes
// joined at matching joints into networks, so one network with no open
// end is sealed -- and its water runs -- before the whole board is.

const N = 64, W = 8;
const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const LINE = 0, ARC = 1, HUB = 2;     // how a slot's water phase runs
var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // opening i's step

// per kind and slot, kind * 2 + slot: the channel (-1 none), the shape,
// and at no turns the openings A and B (a line or an arc runs its phase
// from A to B) or, for a hub, all its openings in B
var kch = new Int32Array(36);
var kshape = new Int32Array(36);
var ka = new Int32Array(36);
var kb = new Int32Array(36);

// the board now
var kind = new Int32Array(N);     // -1 an empty cell
var turns = new Int32Array(N);
var chan = new Int32Array(N * 2); // node's channel, -1 for no slot
var mask = new Int32Array(N * 2); // node's openings; 0 while it turns
var opa = new Int32Array(N * 2);  // A and B turned as the piece is
var opb = new Int32Array(N * 2);
var hub = new Uint8Array(N * 2);  // 1 for a T or cross: water from its middle
var nbr = new Int32Array(N * 4);  // cell * 4 + i: the next cell, -1 off
var across = new Int32Array(N * 8);   // node * 4 + i: the node of the same
                                      // channel in the next cell, -1 none
var live = new Int32Array(N * 2); // the nodes the level has
var liveN = 0;
var BIT = [1, 2, 4, 8], BACK = [4, 8, 1, 2];   // opening i, and its partner's
var pieces = 0;                   // occupied cells

// what analyse() found
var comp = new Int32Array(N * 2); // network of each node, -1 none
var compOpen = new Int32Array(N * 2);
var sealed = new Uint8Array(N * 2);
var openEnd = new Int32Array(N * 8);  // node * 4 + i, each open end
var openN = 0;
var queue = new Int32Array(N * 2);

function setKind(k, s, ch, sh, a, b) {
    var i = k * 2 + s;
    kch[i] = ch; kshape[i] = sh; ka[i] = a; kb[i] = b;
}

function setup() {
    fill(kch, -1);
    for (var c = 0; c < 3; c++) {
        setKind(c * 4, 0, c, LINE, LEFT, RIGHT);
        setKind(c * 4 + 1, 0, c, ARC, RIGHT, DOWN);
        setKind(c * 4 + 2, 0, c, HUB, 0, UP | RIGHT | DOWN);
        setKind(c * 4 + 3, 0, c, HUB, 0, 15);
    }
    var pa = [0, 1, 0], pb = [1, 2, 2];
    for (var p = 0; p < 3; p++) {
        var k = 12 + p * 2;
        setKind(k, 0, pa[p], LINE, LEFT, RIGHT);
        setKind(k, 1, pb[p], LINE, UP, DOWN);
        setKind(k + 1, 0, pa[p], ARC, RIGHT, DOWN);
        setKind(k + 1, 1, pb[p], ARC, LEFT, UP);
    }
    for (var c2 = 0; c2 < N; c2++) {
        var x = c2 % W, y = flr(c2 / W);
        for (var i = 0; i < 4; i++) {
            var nx = x + DX[i], ny = y + DY[i];
            nbr[c2 * 4 + i] = (nx < 0 || ny < 0 || nx >= W || ny >= W) ? -1 : ny * W + nx;
        }
    }
}

function rot1(m) { return ((m << 1) | (m >> 3)) & 15; }

function rotm(m, r) {
    r = r & 3;
    while (r > 0) { m = rot1(m); r--; }
    return m;
}

// sets a cell's nodes from its kind and turns
function place(c) {
    for (var s = 0; s < 2; s++) {
        var n = c * 2 + s;
        var k = kind[c];
        if (k < 0 || kch[k * 2 + s] < 0) {
            chan[n] = -1; mask[n] = 0; opa[n] = 0; opb[n] = 0; hub[n] = 0;
            continue;
        }
        var i = k * 2 + s, r = turns[c];
        chan[n] = kch[i];
        hub[n] = kshape[i] == HUB ? 1 : 0;
        opa[n] = rotm(ka[i], r);
        opb[n] = rotm(kb[i], r);
        mask[n] = kshape[i] == HUB ? opb[n] : opa[n] | opb[n];
    }
}

// a level's cells: 0 empty, else 1 + kind * 4 + turns
function load(cells) {
    pieces = 0;
    for (var c = 0; c < N; c++) {
        var v = cells[c];
        kind[c] = v == 0 ? -1 : flr((v - 1) / 4);
        turns[c] = v == 0 ? 0 : (v - 1) % 4;
        if (v != 0) pieces++;
        place(c);
    }
    liveN = 0;
    for (var n = 0; n < N * 2; n++) {
        if (chan[n] >= 0) live[liveN++] = n;
        for (var i = 0; i < 4; i++) {
            var j = nbr[(n >> 1) * 4 + i], m = -1;
            if (j >= 0 && chan[n] >= 0) {
                if (chan[j * 2] == chan[n]) m = j * 2;
                else if (chan[j * 2 + 1] == chan[n]) m = j * 2 + 1;
            }
            across[n * 4 + i] = m;
        }
    }
}

// the node across opening i of node n that meets it, or -1
function partner(n, i) {
    var m = across[n * 4 + i];
    return m >= 0 && (mask[m] & BACK[i]) != 0 ? m : -1;
}

// The analysis is a job, worked a few nodes a tick: on a full board it
// costs a whole tick's time on the slowest player. begin() starts it;
// work(n) takes up to n nodes and is true once it is done. analyse() is
// the whole of it at once, for a level being laid.
var busy = 0;
var jq = 0, jc = 0, jopen = 0, jhead = 0, jtail = 0, jn = 0;

function analyse() {
    begin();
    work(N * 2);
}

function begin() {
    fill(comp, -1);
    openN = 0;
    jq = 0; jc = -1; jhead = 0; jtail = 0; jn = 0;
    busy = 1;
}

// The four openings are written out rather than looped: the loop doubles
// the cost of a node.
function work(budget) {
    var b;
    while (budget > 0) {
        if (jhead == jtail) {
            if (jc >= 0) compOpen[jc] = jopen;
            while (jq < liveN && (mask[live[jq]] == 0 || comp[live[jq]] >= 0)) jq++;
            if (jq >= liveN) break;
            jc = jn++;
            jopen = 0;
            jhead = 0; jtail = 1;
            queue[0] = live[jq];
            comp[live[jq]] = jc;
        }
        budget--;
        var c = jc, open = 0, tail = jtail;
        var a = queue[jhead++], m = mask[a], a4 = a * 4;
        if (m & UP) {
            b = across[a4];
            if (b < 0 || (mask[b] & DOWN) == 0) { open++; openEnd[openN++] = a4; }
            else if (comp[b] < 0) { comp[b] = c; queue[tail++] = b; }
        }
        if (m & RIGHT) {
            b = across[a4 + 1];
            if (b < 0 || (mask[b] & LEFT) == 0) { open++; openEnd[openN++] = a4 + 1; }
            else if (comp[b] < 0) { comp[b] = c; queue[tail++] = b; }
        }
        if (m & DOWN) {
            b = across[a4 + 2];
            if (b < 0 || (mask[b] & UP) == 0) { open++; openEnd[openN++] = a4 + 2; }
            else if (comp[b] < 0) { comp[b] = c; queue[tail++] = b; }
        }
        if (m & LEFT) {
            b = across[a4 + 3];
            if (b < 0 || (mask[b] & RIGHT) == 0) { open++; openEnd[openN++] = a4 + 3; }
            else if (comp[b] < 0) { comp[b] = c; queue[tail++] = b; }
        }
        jopen += open;
        jtail = tail;
    }
    if (budget == 0) return 0;
    fill(sealed, 0);
    for (var q2 = 0; q2 < liveN; q2++) {
        var n2 = live[q2];
        if (mask[n2] != 0 && compOpen[comp[n2]] == 0) sealed[n2] = 1;
    }
    busy = 0;
    return 1;
}

function solved() { return pieces > 0 && openN == 0 && !busy; }

// A turn in two halves. lift() takes the piece out of the network, its
// openings held shut: taking a piece out can only open the networks it
// was in, so lift() marks those unsealed without an analysis. turn() puts
// it back a quarter on, and the analysis of the board as it will be can
// then run while the piece is seen turning.
function lift(c) {
    var c0 = sealed[c * 2] ? comp[c * 2] : -1;
    var c1 = sealed[c * 2 + 1] ? comp[c * 2 + 1] : -1;
    mask[c * 2] = 0;
    mask[c * 2 + 1] = 0;
    if (c0 < 0 && c1 < 0) return;
    for (var q = 0; q < liveN; q++) {
        var n = live[q], k = comp[n];
        if (k >= 0 && (k == c0 || k == c1)) sealed[n] = 0;
    }
}

function turn(c) {
    turns[c] = (turns[c] + 1) & 3;
    place(c);
}

// the nearest occupied cell from c, stepping (dx, dy); -1 when none
function scan(c, dx, dy) {
    var x = c % W + dx, y = flr(c / W) + dy;
    while (x >= 0 && y >= 0 && x < W && y < W) {
        if (kind[y * W + x] >= 0) return y * W + x;
        x += dx; y += dy;
    }
    return -1;
}

// the next occupied cell in reading order, d 1 or -1, wrapping
function step(c, d) {
    for (var i = 1; i <= N; i++) {
        var j = (c + d * i + N * 2) % N;
        if (kind[j] >= 0) return j;
    }
    return c;
}

function firstPiece() {
    for (var c = 0; c < N; c++) if (kind[c] >= 0) return c;
    return 0;
}
