// menus: the title, with the word LOOP made of pipes, and the level
// select, a grid of the 32 levels.
//
// The title's word is a board in the field like any level's, its two O's
// sealed and full, the L and P open: the rule, shown.
//
// In both, Prev and Menu go back an item and Next and Play on; the wheel
// steps; Select chooses. On the level select Menu returns to the title.

const C_BG = 1, C_SURF = 3, C_DIM = 4, C_INK = 6, C_ACC = 7, C_ON = 8, C_LOCK = 10;
const GRID_X = 8, GRID_Y = 16, BOX_W = 16, BOX_H = 14, GAP_X = 18, GAP_Y = 17;
var ITEMS = ["PLAY", "LEVELS"];

var pick = 0;
var lsel = 0;

// ---- the title -----------------------------------------------------------

function titleUpdate() {
    var st = wheelsteps();
    var was = pick;
    if (btnp(0) || btnp(2) || st < 0) pick = max(0, pick - 1);
    if (btnp(1) || btnp(3) || st > 0) pick = min(1, pick + 1);
    if (pick != was) sfx(SFX.tick);
    if (!btnp(4)) return;
    if (pick == 0) startLevel(records.unlocked - 1);
    else toLevels();
}

function titleDraw() {
    tiles.whole();
    for (var i = 0; i < 2; i++) {
        var w = textw(ITEMS[i]), y = 66 + i * 12;
        if (i == pick) rectfill(80 - (w >> 1) - 4, y - 3, 80 + (w >> 1) + 3, y + 7, C_ACC);
        hud.centre(ITEMS[i], 80, y, i == pick ? C_ON : C_INK);
    }
    hud.centre("ORIGINAL GAME BY KREYK29", 80, 96, C_DIM);
    hud.centre("HOLD MENU FOR OPTIONS", 80, 106, C_DIM);
}

// ---- the level select ----------------------------------------------------------

function levelsUpdate() {
    var st = wheelsteps();
    var was = lsel;
    if (btnp(0)) lsel = (lsel + 31) % 32;
    if (btnp(1)) lsel = (lsel + 1) % 32;
    lsel = ((lsel + st) % 32 + 32) % 32;
    if (btnp(3)) lsel = (lsel + 8) % 32;
    if (lsel != was) sfx(SFX.tick);
    if (btnp(2)) {
        toTitle();
        return;
    }
    if (!btnp(4)) return;
    if (lsel < records.unlocked) startLevel(lsel);
    else sfxp(SFX.tick, -12);
}

// Each box holds liquid: a layer once a level is solved, full when it
// was solved in the fewest turns.
function levelsDraw() {
    cls(C_BG);
    hud.centre("CHOOSE A LEVEL", 80, 4, C_INK);
    for (var i = 0; i < 32; i++) {
        var x = GRID_X + (i % 8) * GAP_X, y = GRID_Y + flr(i / 8) * GAP_Y;
        var open = i < records.unlocked, best = records.moves[i];
        if (open) rectfill(x + 1, y, x + BOX_W - 2, y + BOX_H - 1, C_SURF);
        if (open) rectfill(x, y + 1, x + BOX_W - 1, y + BOX_H - 2, C_SURF);
        if (!open) rect(x, y, x + BOX_W - 1, y + BOX_H - 1, C_LOCK);
        if (best > 0) {
            var h = best == levels[i].par ? BOX_H - 2 : 3;
            for (var r = 0; r < h; r++)
                line(x + 1, y + BOX_H - 2 - r, x + BOX_W - 2, y + BOX_H - 2 - r, 16 + ((r >> 1) & 1));
        }
        if (open) hud.centre("" + (i + 1), x + 8, y + 4, C_INK);
        else spr(2, x + 5, y + 4);
        if (i == lsel) rect(x - 2, y - 2, x + BOX_W + 1, y + BOX_H + 1, C_ACC);
    }
    var lv = lsel;
    print("LEVEL " + (lv + 1), 8, 88, C_INK);
    var parText = "PAR " + levels[lv].par;
    print(parText, 152 - textw(parText), 88, C_DIM);
    if (lv >= records.unlocked) {
        print("LOCKED", 8, 98, C_DIM);
    } else if (records.moves[lv] == 0) {
        print("UNPLAYED", 8, 98, C_DIM);
    } else {
        print("BEST " + records.moves[lv] + " MOVES / " + records.clock(records.ms[lv]), 8, 98, C_INK);
    }
    print("MENU: BACK", 8, 110, C_DIM);
}
