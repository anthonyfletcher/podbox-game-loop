// theme: the eight palettes of the Palette option. Each is chosen whole:
// background, pipe, text, an accent, and the three liquids (water, oil,
// green). The rest is mixed from those here, and the text colours are
// darkened or lightened until they read at 4.5:1 on what they sit on.

var THEMES = [
    // background, pipe, text, accent, water, oil, green
    0xf3ead8, 0x3b3646, 0x2b2733, 0xd9532f, 0x2f86d2, 0xd99a2b, 0x3aa37a,   // Dune
    0x151926, 0xc8cfdd, 0xeef1f7, 0xe7b85d, 0x4fa8f0, 0xe0a24a, 0x5cc79a,   // Night
    0xdfe6d6, 0x2c3a31, 0x1f2a23, 0xb5523b, 0x3a87a8, 0xc99a52, 0x5f9a4a,   // Sage
    0xfbe6dc, 0x4a2c39, 0x3a2230, 0x2f7f8a, 0x3b8fd0, 0xf2a53c, 0x46a07a,   // Coral
    0x2a303c, 0xe7e2d4, 0xf4f1ea, 0xf2c14e, 0x7fbbe8, 0xf2a96a, 0x8fd19a,   // Slate
    0xe6f3ee, 0x1f3b39, 0x173130, 0xe0565b, 0x2a93b8, 0xe8a64a, 0x3fa58e,   // Mint
    0xeeeeea, 0x2a2a2a, 0x1c1c1c, 0x1c1c1c, 0x77776f, 0xa3a39b, 0x4f4f4a,   // Paper
    0x100c22, 0xf3eeff, 0xffffff, 0xff4fa3, 0x3df5d3, 0xffd23f, 0x6c8cff    // Neon
];
const PER = 7;

function apply(i) {
    var o = i * PER;
    var bg = THEMES[o], pipe = THEMES[o + 1], ink = THEMES[o + 2], acc = THEMES[o + 3];
    // the dim text: as far toward the ink as it needs to read
    var t = 0.55, dim = color.mix(bg, ink, t);
    while (color.contrast(dim, bg) < 4.5 && t < 1.0) { t += 0.05; dim = color.mix(bg, ink, t); }
    // the text on the accent: whichever reads best, the accent moved
    // away from it until it reads well enough
    var on = 0xffffff;
    if (color.contrast(0x000000, acc) > color.contrast(on, acc)) on = 0x000000;
    if (color.contrast(bg, acc) > color.contrast(on, acc)) on = bg;
    var away = color.tone(on) > 50 ? 0x000000 : 0xffffff, n = 0;
    while (color.contrast(on, acc) < 4.5 && n < 12) { acc = color.mix(acc, away, 0.08); n++; }
    setpal(0, bg);                                  // air
    setpal(1, bg);
    setpal(2, color.mix(bg, ink, 0.16));            // dots
    setpal(3, color.mix(bg, pipe, 0.1));            // surface
    setpal(4, dim);
    setpal(5, pipe);
    setpal(6, ink);
    setpal(7, acc);
    setpal(8, on);
    setpal(10, color.mix(bg, ink, 0.22));           // locked
    setpal(11, bg);                                 // the floor: unseen
    setpal(12, bg);                                 // an empty pipe's inside
    for (var k = 0; k < 3; k++) {
        var c = THEMES[o + 4 + k];
        // a liquid is two materials, one flat colour; its spill and its
        // pool are the same colour too
        for (var m = 0; m < 2; m++) {
            setpal(16 + k * 2 + m, c);
            setpal(24 + k * 2 + m, c);
            setpal(48 + k * 2 + m, c);
        }
    }
}
