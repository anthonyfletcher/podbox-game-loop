// Loop: turn the pipes until every channel is sealed.
//
// After Loop by kreyk29 (2022, PICO-8), whose 32 levels these are; see
// CREDITS.md. Written afresh for the Arcade.
//
//   main.js     the states, a turn of a piece, the level timer, the finish
//   board.js    the puzzle: pieces, the sealing test, finding the next cell
//   water.js    the board as a cells field: pipe walls and liquids
//   tiles.js    drawing the field, and keeping the screen up to date
//   hud.js      the column beside the board, and the result in it
//   menus.js    the title and the level select
//   records.js  levels unlocked and the best runs, in the store
//   theme.js    the eight palettes
//
// The screen: the field, the board in it at 4, 1 and spills gathering
// along the bottom the whole width; the column on the right, over it.
//
// Controls in play: Prev and Next move left and right, Menu up and Play
// down, to the next piece that way; the wheel steps through the pieces in
// reading order. Select turns a piece a quarter clockwise. Holding Menu
// opens the pause menu: Restart Level, Level Select and the options.

const TITLE = 0, LEVELS = 1, PLAY = 2;
const BOARD_X = 4, BOARD_Y = 1;         // the board in play, in the field
const TITLE_X = 24, TITLE_Y = 14;       // the word LOOP on the title
const TURN_TICKS = 5;                   // a quarter turn, about 150 ms
const QUEUE = 4;

var state = TITLE;
var levels;                             // data/levels.json: cells and par
var bx = BOARD_X, by = BOARD_Y;         // the board's top left on the screen
var level = 0;                          // 0-31
var cur = 0;                            // the cursor's cell
var curX = 0.0, curY = 0.0;             // where it is drawn, easing over
var moves = 0;
var started = 0.0;                      // t() when the level's timer started
var timing = false;
var turnT = 0;                          // ticks into the turn
var queued = new Int32Array(QUEUE);     // presses made during a turn, in order
var queuedN = 0;
var spin = -1;                          // the piece seen turning
var landed = -1;                        // the piece last turned, its pour
                                        // waiting for the analysis
var solvedNext = false;                 // finish next tick
var selWas = 0;
var doneT = -1;                         // ticks since solved; -1 playing
var result = 0;                         // what the run beat: records.*
var runMs = 0;
var full = true;                        // draw the whole screen next frame
var slow = false;                       // the water at half speed
var late = 0;

// the title's word, as a level: L, O, O and P in the thick pipe, poured
// into from the tops of the L and the P (TITLE_POURS); the O's are sealed
var TITLE_POURS = [0, 6];
var WORD = [
    2, 0, 5, 6, 5, 6, 5, 6,
    2, 0, 2, 2, 2, 2, 9, 7,
    8, 1, 8, 7, 8, 7, 2, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0
];

function init() {
    levels = data.read(DATA.levels);
    board.setup();
    water.setup();
    records.load();
    theme.apply(opt.get(OPT.palette));
    toTitle();
}

function update() {
    if (opt.changed()) {
        theme.apply(opt.get(OPT.palette));
        full = true;
    }
    if (resumed()) full = true;
    pace();
    water.step();
    if (state == TITLE) menus.titleUpdate();
    else if (state == LEVELS) menus.levelsUpdate();
    else playUpdate();
}

// Once a second: more than four frames late, and the game steps down,
// 33 ticks a second to 25 to 20, and below that moves the water every
// other tick; a second with at most one late frame steps back up. The
// water moves a tick at a time, so at a lower rate it flows slower too.
function pace() {
    late += skipped();
    if (frame() % rate() != 0) return;
    if (late > 4) {
        if (rate() == 33) setrate(25);
        else if (rate() == 25) setrate(20);
        else slow = true;
    } else if (late <= 1) {
        if (slow) slow = false;
        else if (rate() == 20) setrate(25);
        else if (rate() == 25) setrate(33);
    }
    late = 0;
}

// The level timer runs on t(), which stops while the game is paused and
// carries on smoothly when the rate changes. It starts at the first move
// of the cursor or the first turn.
function startTimer() {
    if (timing) return;
    timing = true;
    started = t();
}

// the time so far, in ms -- the run's own once it is finished; t() is a
// fraction, so it is split before the thousandfold to stay inside a
// fraction's range
function elapsed() {
    if (!timing) return doneT >= 0 ? runMs : 0;
    var e = t() - started, s = flr(e);
    return s * 1000 + flr((e - s) * 1000);
}

function draw() {
    if (state == PLAY) playDraw();
    else if (state == TITLE) {
        cls(1);
        menus.titleDraw();
    } else {
        menus.levelsDraw();
    }
}

// ---- moving between states ---------------------------------------------------

function toTitle() {
    state = TITLE;
    lay(WORD, TITLE_X, TITLE_Y);
    menuitem(1);
    menuitem(2);
}

function toLevels() {
    state = LEVELS;
    menuitem(1);
    menuitem(2);
    menus.lsel = min(level, records.unlocked - 1);
}

function startLevel(lv) {
    state = PLAY;
    level = lv;
    lay(levels[lv].cells, BOARD_X, BOARD_Y);
    cur = nearestMiddle();
    curX = bx + (cur % 8) * 14;
    curY = by + flr(cur / 8) * 14;
    moves = 0; timing = false;
    turnT = 0; queuedN = 0; doneT = -1; spin = -1; landed = -1; solvedNext = false;
    selWas = btn(4);
    full = true;
    menuitem(1, "Restart Level", restartItem);
    menuitem(2, "Level Select", levelsItem);
}

function restartItem() { startLevel(level); }
function levelsItem() { toLevels(); }

// a set of cells on the board at x, y in the field, afresh
function lay(cells, x, y) {
    bx = x; by = y;
    water.ox = x; water.oy = y;
    board.load(cells);
    board.analyse();
    water.lay();
}

function nearestMiddle() {
    var best = board.firstPiece(), bd = 999;
    for (var c = 0; c < 64; c++) {
        if (board.kind[c] < 0) continue;
        var dx = (c % 8) * 2 - 7, dy = flr(c / 8) * 2 - 7;
        var d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = c; }
    }
    return best;
}

// ---- play ----------------------------------------------------------------------

function playUpdate() {
    var sel = btn(4), press = sel && !selWas;
    selWas = sel;
    if (solvedNext) {
        solvedNext = false;
        finish();
    }
    // The analysis of a turn runs a few nodes a tick while the piece is
    // seen turning; a full board's is more than one tick can pay for.
    // Once the piece has landed and the analysis is done, a network it
    // sealed is poured -- in a tick of its own, and the next turn in the
    // next.
    if (board.busy) board.work(16);
    var free = landed < 0;
    if (landed >= 0 && !board.busy) {
        if (water.pour(landed)) sfx(SFX.seal);
        if (board.solved()) solvedNext = true;
        landed = -1;
    }
    if (doneT >= 0) {
        doneT++;
        hud.finishUpdate(press);
        return;
    }
    var nc = -1;
    if (btnp(0)) nc = board.scan(cur, -1, 0);
    if (btnp(1)) nc = board.scan(cur, 1, 0);
    if (btnp(2)) nc = board.scan(cur, 0, -1);
    if (btnp(3)) nc = board.scan(cur, 0, 1);
    var st = wheelsteps();
    if (st != 0) {
        nc = cur;
        for (var i = 0; i < abs(st); i++) nc = board.step(nc, st > 0 ? 1 : -1);
    }
    if (nc >= 0 && nc != cur) {
        cur = nc;
        startTimer();
        sfx(SFX.tick);
    }
    if (press) {
        startTimer();
        if (queuedN < QUEUE) queued[queuedN++] = cur;
    }
    if (spin >= 0) turnStep();
    else if (queuedN > 0 && free && !solvedNext) {
        startTurn(queued[0]);
        copy(queued, 0, queued, 1, QUEUE - 1);
        queuedN--;
    }
    curX += (bx + (cur % 8) * 14 - curX) * 0.45;
    curY += (by + flr(cur / 8) * 14 - curY) * 0.45;
}

function cellX(c) { return bx + (c % 8) * 14 + 7; }
function cellY(c) { return by + flr(c / 8) * 14 + 7; }

// A turn begins: the piece leaves the network and turns, the analysis
// of the board as it will be starts, and the piece's walls come out of
// the field, so its liquid and its neighbours' pour out of the gap.
function startTurn(c) {
    turnT = 0;
    var breaks = 0;
    for (var s = 0; s < 2; s++) {
        var n = c * 2 + s, m = board.mask[n];
        for (var i = 0; i < 4; i++)
            if ((m & (1 << i)) != 0 && board.partner(n, i) >= 0) breaks++;
    }
    water.flick(c);
    board.lift(c);
    board.turn(c);
    board.begin();
    water.open(c);
    spin = c;
    sfx(SFX.turn);
    if (breaks > 2) sfx(SFX.splash);
    else if (breaks > 0) sfx(SFX.hiss);
}

// the turn seen, and at its end the walls back in the field
function turnStep() {
    var c = spin;
    turnT++;
    if (turnT < TURN_TICKS) return;
    spin = -1;
    water.close(c);
    var joins = 0;
    for (var s = 0; s < 2; s++) {
        var n = c * 2 + s, ms = board.mask[n];
        for (var k = 0; k < 4; k++)
            if ((ms & (1 << k)) != 0 && board.partner(n, k) >= 0) joins++;
    }
    landed = c;
    moves++;
    if (joins > 0) sfx(SFX.snap);
}

function ease(u) { return 1 - (1 - u) * (1 - u); }

function finish() {
    runMs = elapsed();
    timing = false;
    result = records.submit(level, moves, runMs);
    doneT = 0;
    queuedN = 0;
    hud.finishStart();
    sfx(SFX.solved);
}

// The screen is kept, not cleared: see tiles.js. The field is drawn whole
// only after a pause or a change of palette; otherwise what changed in it
// and what was drawn over it are put back.
function playDraw() {
    if (full) tiles.whole();
    else {
        tiles.restore();
        tiles.drawChanged();
    }
    if (full) hud.whole();
    full = false;
    clip(0, 0, 119, 119);
    var c = spin;
    if (c >= 0) tiles.drawTurning(c, cellX(c), cellY(c), ease(turnT / (TURN_TICKS * 1.0)));
    if (doneT < 0) {
        var x = flr(curX) - 1, y = flr(curY) - 1;
        spr(0, x, y, 2, 2);
        tiles.keep(x, y, 16, 16);
    }
    tiles.drawSplash();
    clip();
    hud.draw();
}
