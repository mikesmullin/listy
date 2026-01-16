**Most professional CAD software** (especially parametric 3D ones like SolidWorks, Fusion 360, Inventor, Creo, etc., but also traditional ones like AutoCAD in a different way) tend to favor **very similar styles** of keyboard input for performing operations quickly.

Here are the most common patterns you will encounter across popular CAD packages:

### 1. Single-letter / Very short alias hotkeys (Classic style – AutoCAD tradition)
Very common in **2D CAD** and still used heavily by many veteran users.

Examples:
- **L** → Line
- **C** → Circle
- **O** → Offset
- **TR** → Trim
- **F** → Fillet
- **CO** or **CP** → Copy

You just type 1–3 characters → **Enter** (or space) and the command starts immediately.  
Many people remap these aliases freely (especially in AutoCAD via `acad.pgp` file).

Blender excels at **precise modeling** thanks to its very flexible **numeric input system** during almost any transform/operation.

After starting most commands (like move, rotate, scale, extrude, inset, bevel, etc.), you can immediately **type numbers** on the keyboard — no need to click any field first. The value appears in the status bar (bottom of the 3D Viewport) and gets applied when you confirm with **Enter** / **Left Click**.

Here are the most common and useful real-world examples (Blender 4.x / 5.x behavior, as of 2026):

### Basic transforms (very frequently used)

| Operation              | Keys to start       | Numeric input examples                              | Result / Notes                                      |
|-------------------------|---------------------|------------------------------------------------------|-----------------------------------------------------|
| Move / Grab            | `G`                 | `G` → `5` → `Enter`<br>`G` → `3.14` → `Enter`      | Move exactly 5 / 3.14 units along current axis      |
| Move on specific axis  | `G` → `X` / `Y` / `Z` | `G` → `Z` → `2.5` → `Enter`                       | Move 2.5 units straight up (global/local Z)         |
| Move exact distance    | `G` → `X` → `45`    | `G` → `X` → `-12.7` → `Enter`                      | Move -12.7 units along X (negative = opposite dir)  |
| Rotate                 | `R`                 | `R` → `90` → `Enter`<br>`R` → `Z` → `45` → `Enter` | 90° around current pivot / 45° around Z-axis        |
| Rotate precise         | `R` → `X` → `22.5`  | `R` → `X` → `360/8` → `Enter` (advanced mode)     | Exactly 45° using math expression                   |
| Scale                  | `S`                 | `S` → `2` → `Enter`<br>`S` → `0.5` → `Enter`       | Double size / halve size uniformly                  |
| Scale non-uniform      | `S` → `Shift`+`Z`   | `S` → `Shift`+`Z` → `1.5` → `Enter`                | Scale 150% in X/Y plane only (exclude Z)            |

### Modeling operations (Edit Mode favorites)

| Operation              | Keys to start       | Numeric input examples                                      | Result / Notes                                              |
|-------------------------|---------------------|--------------------------------------------------------------|-------------------------------------------------------------|
| Extrude                | `E`                 | `E` → `4` → `Enter`<br>`E` → `Z` → `25` → `Enter`           | Extrude 4 units free / 25 units straight up                 |
| Extrude along normals  | `Alt`+`E` → "Extrude Faces Along Normals" | `Alt`+`E` → normals → `0.8` → `Enter`   | Inset-like thickening, very useful for 3D printing          |
| Inset                  | `I`                 | `I` → `0.15` → `Enter`                                      | Inset faces exactly 0.15 units                              |
| Bevel                  | `Ctrl`+`B`          | `Ctrl`+`B` → drag a bit → `0.04` → `Enter` → `P` → `3` → `Enter` | Bevel 0.04 units, 3 segments (very clean hard-surface)     |
| Loop Cut               | `Ctrl`+`R`          | `Ctrl`+`R` → hover → `8` → `Enter` → move → `0.25` → `Enter` | 8 cuts + position at 25% along the edge                     |
| Edge Slide / Vertex Slide | `G` + `G`        | `G` `G` → `0.33` → `Enter`                                  | Slide exactly 1/3 of the way along the edge                 |

### Quick power tips for numeric input

- Type **decimal** values directly: `0.5`, `3.1416`, `-2.54`
- Negative values: just start with `-`
- Advanced mode (very powerful): press `=` or `*` (numpad) after starting the operation → now you can write:
  - `360/12` → 30°
  - `5*2.54` → 12.7 (inches to cm if unit scale = 0.01)
  - `sin(30)` or `pi*2` (radians)
- Multi-axis input: after typing first number press `Tab` → next axis (very useful for move/scale)
  Example: `G` → `5` → `Tab` → `0` → `Tab` → `-3` → `Enter` → move (5, 0, -3)
- Cancel: `Esc` or right-click at any time
- Confirm: `Enter` / `Left Click` / `Numpad .` (period)

Blender's numeric input is one of the strongest aspects when coming from CAD-style programs — once you get used to just typing numbers right after the hotkey, it becomes extremely fast and accurate.
