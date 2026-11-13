// hud: the column beside the board. In play it shows the level, moves,
// par, time and best; once the board is solved it becomes the result --
// SOLVED, the moves and time, a new best -- with the three actions as
// buttons, and the solved board stays in view.

const X = 122;                          // the column's left edge
const C_BG = 1, C_DIM = 4, C_INK = 6, C_ACC = 7, C_ON = 8;
const SHOW_AT = 10;                     // ticks after solving it shows
const BOTTOM = 119 - 6;                 // the column's last row: the pool's
                                        // rows below it (water.POOL_ROWS)
var ACTIONS = ["NEXT", "REPLAY", "LEVELS"];

var pick = 0;                           // 0 next, 1 replay, 2 levels
var shownMoves = -1;                    // the moves as last drawn
var drawnPick = -1;                     // the result as last drawn

function big(s, x, y, c) {
    font(FONT.CAPS, 2);
    print(s, x, y, c);
    font(FONT.CAPS);
}

function centre(s, x, y, c) {
    print(s, x - (textw(s) >> 1), y, c);
}

// a button: the accent behind it when chosen
function button(s, x, y, on) {
    if (on) rectfill(x - 2, y - 2, x + 35, y + 6, C_ACC);
    print(s, x, y, on ? C_ON : C_INK);
}

// ---- in play ------------------------------------------------------------------------

// the column whole; then draw() keeps the moves and the time up to date
function whole() {
    rectfill(X - 2, 0, 159, BOTTOM, C_BG);
    if (shown()) {
        drawnPick = -1;
        return;
    }
    print("LEVEL", X, 4, C_DIM);
    big("" + (level + 1), X, 11, C_INK);
    print("MOVES", X, 30, C_DIM);
    print("PAR " + levels[level].par, X, 56, C_DIM);
    print("TIME", X, 70, C_DIM);
    print("BEST", X, 94, C_DIM);
    var b = records.moves[level];
    if (b == 0) {
        print("UNPLAYED", X, 101, C_DIM);
    } else {
        print(b + " MOVES", X, 101, C_INK);
        print(records.clock(records.ms[level]), X, 108, C_INK);
    }
    shownMoves = -1;
}

function draw() {
    if (shown()) {
        showResult();
        return;
    }
    if (moves != shownMoves) {
        shownMoves = moves;
        rectfill(X, 37, 159, 50, C_BG);
        big("" + moves, X, 37, C_INK);
    }
    rectfill(X, 77, 159, 83, C_BG);
    print(records.clock(elapsed()), X, 77, C_INK);
}

// ---- solved ----------------------------------------------------------------------------

function last() { return level == records.LEVELS - 1; }

function finishStart() {
    pick = last() ? 2 : 0;
    drawnPick = -1;
}

function shown() { return doneT >= SHOW_AT; }

function finishUpdate(press) {
    if (!shown()) return;
    if (last()) {
        if (press) toLevels();
        return;
    }
    var st = wheelsteps(), was = pick;
    if (btnp(0) || btnp(2) || st < 0) pick = max(0, pick - 1);
    if (btnp(1) || btnp(3) || st > 0) pick = min(2, pick + 1);
    if (pick != was) sfx(SFX.tick);
    if (!press) return;
    if (pick == 0) startLevel(level + 1);
    else if (pick == 1) startLevel(level);
    else toLevels();
}

// the result, drawn when it first shows and when the choice changes
function showResult() {
    if (pick == drawnPick) return;
    drawnPick = pick;
    rectfill(X - 2, 0, 159, BOTTOM, C_BG);
    var par = levels[level].par;
    print("LEVEL " + (level + 1), X, 4, C_DIM);
    print(last() ? "ALL DONE" : "SOLVED", X, 12, C_ACC);
    print("MOVES", X, 26, C_DIM);
    big("" + moves, X, 33, C_INK);
    print(moves == par ? "AT PAR" : "PAR " + par, X, 50, moves == par ? C_ACC : C_DIM);
    print("TIME", X, 62, C_DIM);
    print(records.clock(runMs), X, 69, C_INK);
    if (result != records.NONE) {
        rectfill(X - 2, 77, X + 35, 85, C_INK);
        print("NEW BEST", X, 79, C_BG);
    }
    if (last()) {
        button("LEVELS", X, 100, true);
        return;
    }
    for (var i = 0; i < 3; i++) button(ACTIONS[i], X, 89 + i * 9, i == pick);
}
