// records: levels unlocked, and each level's best run, kept in the
// store as one value so the moves and the time are always written
// together.
//
// A run beats the record with fewer moves, whatever the time; with the
// same moves, a shorter time. A level with no record holds 0 moves.

const LEVELS = 32;
const NONE = 0, BEST_MOVES = 1, BEST_TIME = 2;

var unlocked = 1;
var moves = new Int32Array(LEVELS);
var ms = new Int32Array(LEVELS);

function load() {
    var r = store.read("records");
    if (r == null || typeof r != "object") return;
    if (typeof r.unlocked == "number") unlocked = mid(1, flr(r.unlocked), LEVELS);
    if (r.moves == null || r.ms == null || r.moves.length != LEVELS || r.ms.length != LEVELS)
        return;
    for (var i = 0; i < LEVELS; i++) {
        var m = r.moves[i], t = r.ms[i];
        if (typeof m == "number" && typeof t == "number" && m > 0 && t >= 0) {
            moves[i] = m;
            ms[i] = t;
        }
    }
}

function save() {
    store.write("records", { unlocked: unlocked, moves: moves, ms: ms });
}

// a finished run of level lv (0-31): what it beat, and the record kept
function submit(lv, m, t) {
    var won = NONE;
    if (moves[lv] == 0 || m < moves[lv]) won = BEST_MOVES;
    else if (m == moves[lv] && t < ms[lv]) won = BEST_TIME;
    if (won != NONE) { moves[lv] = m; ms[lv] = t; }
    if (lv + 2 > unlocked) unlocked = min(LEVELS, lv + 2);
    save();
    return won;
}

// ms as MM:SS.hh
function clock(t) {
    var cs = flr(t / 10), s = flr(cs / 100), m = flr(s / 60);
    return two(min(m, 99)) + ":" + two(s % 60) + "." + two(cs % 100);
}

function two(v) { return v < 10 ? "0" + v : "" + v; }
