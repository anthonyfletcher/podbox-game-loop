// tiles: drawing the board from the field, and keeping the screen up to
// date for little.
//
// The field (water.js) is the screen's picture, a pixel of it the same
// pixel of the screen. Right of the board, the column's text has the
// screen above the pool's rows (water.POOL_ROWS), so there only those
// rows of the field are drawn. The screen is kept, not
// redrawn: each frame copies back from the field only the box that the
// field's steps changed (drawChanged), and what was drawn over the board
// -- the cursor, the turning piece, the splash -- which keep() notes and
// restore() puts back.
//
// pipes.png has each kind's four turns side by side, two kinds to a row
// of 16 x 16 frames (see board.js for the kinds). A frame's art fills its
// middle 14 x 14, which is a cell.

const KEEP = 32;

var kx = new Int32Array(KEEP), ky = new Int32Array(KEEP);
var kw = new Int32Array(KEEP), kh = new Int32Array(KEEP);
var kn = 0;
var box = new Int32Array(4);       // particles.bounds' answer

// the sprite number in pipes.png of a kind at r turns: the top left of
// its 2 x 2 block
function frameOf(k, r) {
    return flr(k / 2) * 32 + ((k % 2) * 4 + r) * 2;
}

const COLUMN = 120;                 // where the column beside the board starts

// the field as it is, all of it; air is drawn as the background
function whole() {
    palt(0, false);
    blit(water.field, 0, 0);
    palt();
    water.dx1 = -1;
    kn = 0;
}

// the part of the field its steps changed since the last frame, but in
// the column only the pool's rows; air is drawn as the background
function drawChanged() {
    if (water.dx1 < 0) return;
    palt(0, false);
    part(water.dx0, water.dy0, min(water.dx1, COLUMN - 1), water.dy1);
    part(max(water.dx0, COLUMN), max(water.dy0, water.H - water.POOL_ROWS), water.dx1, water.dy1);
    palt();
    water.dx1 = -1;
}

function part(x0, y0, x1, y1) {
    if (x1 >= x0 && y1 >= y0) blitpart(water.field, x0, y0, x1 - x0 + 1, y1 - y0 + 1, x0, y0);
}

// puts back what was kept; returns whether anything was
function restore() {
    var any = kn;
    palt(0, false);
    for (var i = 0; i < kn; i++) {
        var x = max(kx[i], 0), y = max(ky[i], 0);
        var w = min(kx[i] + kw[i], 120) - x, h = min(ky[i] + kh[i], 120) - y;
        if (w > 0 && h > 0) blitpart(water.field, x, y, w, h, x, y);
    }
    palt();
    kn = 0;
    return any > 0;
}

// a place drawn over the board, to be put back next frame
function keep(x, y, w, h) {
    if (kn < KEEP) { kx[kn] = x; ky[kn] = y; kw[kn] = w; kh[kn] = h; kn++; }
}

// the turning piece, empty, over its cell: cx, cy is the cell's centre,
// a the turn so far, 0 to 1. The board already holds it turned, so it
// is drawn from a quarter back.
function drawTurning(c, cx, cy, a) {
    sheet(IMG.pipes);
    palt(32, true); palt(40, true);
    rspr(frameOf(board.kind[c], (board.turns[c] + 3) & 3), cx, cy, -0.25 * a, 1.0, 2, 2);
    palt();
    sheet();
    keep(cx - 12, cy - 12, 25, 25);
}

// the splash and the flicked droplets in the air, and the box round
// each kept
function drawSplash() {
    drawPool(water.splash);
    drawPool(water.flicks);
}

function drawPool(p) {
    particles.draw(p);
    if (particles.bounds(p, box) > 0)
        keep(box[0], box[1], box[2] - box[0] + 1, box[3] - box[1] + 1);
}
