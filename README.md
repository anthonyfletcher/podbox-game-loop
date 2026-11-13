# Loop

A pipe puzzle for the Arcade on an iPod running
[PodBox](https://github.com/anthonyfletcher/podbox), after
[Loop](https://kreyk29.itch.io/loop) by kreyk29.

Turn the pipes until every channel meets its own kind in the next cell:
thick to thick, twin to twin, thin to thin. A network with no open end
fills with its liquid, and an open end leaks until you seal it. When every
network is full, the level is done. Fewest turns wins; time breaks a tie.
32 levels, the original's own.

## Playing it

- **On the iPod:** download `loop.pbg` from the latest
  [release](https://github.com/anthonyfletcher/podbox-game-loop/releases),
  copy it anywhere onto the iPod, eject, and choose **Arcade** on the main
  menu.
- **In a browser:** <https://anthonyfletcher.github.io/podbox-game-loop/>,
  with the keys or a phone's touch wheel.

Prev and Next move left and right, Menu up and Play down; the wheel steps
through the pipes. Select turns a pipe. Eight palettes are in the pause
menu (hold Menu).

## Changing it

The game is the `loop` folder. Open it in the
[Arcade IDE](https://anthonyfletcher.github.io/podbox/ide/) in Chrome or
Edge with **Cart > Open folder**; it saves back into the folder. Every push
builds `loop.pbg` (the **Actions** tab, under **Artifacts**) and puts the
web page up to date. Push a tag -- `git tag v2 && git push --tags` -- to
attach the `.pbg` to a release of that name.

The [Arcade manual](https://github.com/anthonyfletcher/podbox/blob/master/arcade/manual/README.md)
covers the language and every function. With
[Claude Code](https://claude.com/claude-code), the Arcade skill in
`.claude/skills/podbox-arcade` is loaded when you ask for help with the
game.

## Credits and licence

Loop is kreyk29's game: <https://kreyk29.itch.io/loop>, with the original
PICO-8 cart at <https://www.lexaloffle.com/bbs/?pid=109978>. This version
is written afresh for the Arcade, and keeps the original's 32 levels.

- The levels (`loop/data/levels.json`) are kreyk29's, under
  [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/):
  credit kreyk29, no commercial use, and share anything made from them
  alike. `loop/CREDITS.md` has the details.
- The rest of this repository is under the 0BSD licence (`LICENSE`).
- The skill in `.claude/skills` is text from the PodBox manual, under the
  GPL version 2.
