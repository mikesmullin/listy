# Listy - Project Plan

## Overview

**Listy** is a prototype CLI tool inspired by CAD-style keyboard input (Blender/AutoCAD) that provides fast, hotkey-driven command execution. It supports both real-time REPL interaction and traditional POSIX shell composition.

---

## Architecture

### Two Modes

| Mode   | Description                                                                 |
|--------|-----------------------------------------------------------------------------|
| REPL   | Real-time raw stdin input with statusbar display (vim-like)                 |
| SHELL  | Traditional CLI invocation for scripting/piping (`listy cmd args...`)       |

### Input Sources

- Keyboard (raw stdin in REPL mode)
- Jog wheel (MIDI CC controller 0x0A, CW/CCW events via `/dev/snd/midiC*`)

---

## Configuration: Activity Files

### Multi-Activity Architecture

Instead of a single `config.yml`, listy uses multiple **activity files** located under:

```
~/.config/listy/activity/
├── robin.yml       # Stock/options trading (robin CLI)
├── git.yml         # Git operations
├── docker.yml      # Container management
├── notes.yml       # Note-taking commands
└── ...             # Any number of activities
```

On startup, listy reads all `activity/*.yml` files and makes them available.

### Activity Switching

| Key     | Action                                      |
|---------|---------------------------------------------|
| `Tab`   | Rotate to next activity (cyclic)            |
| `S-Tab` | Rotate to previous activity                 |

The current activity is always visible in the statusbar (leftmost position).

---

### Example: `activity/robin.yml`

```yaml
# ~/.config/listy/activity/robin.yml
name: robin
description: Stock & Options Trading

# ─────────────────────────────────────────────────────────────────
# VARIABLES
# ─────────────────────────────────────────────────────────────────
# Variables define typed, range-constrained values that can be:
#   - Set via `:set VAR value`
#   - Adjusted via jog wheel (CW/CCW) or +/- keys
#   - Bound to a hotkey for quick editing
#
variables:
  QTY:
    type: int
    default: 10
    range: [1, 100]           # min, max
    step: 1                   # jog/+/- increment
    format: "%d"              # printf-style display
    hotkey: q                 # press 'q' to enter :set QTY mode

  SYMBOL:
    type: enum
    default: SPY
    range: [SPY, QQQ, IWM, TSLA, AAPL, NVDA, AMD, MSFT]
    hotkey: s
    # jog wheel / +/- rotates through the enum values

  EXP:
    type: date
    # default omitted → uses current date
    range: 2025-01-01..2026-12-31   # valid date range
    step: 1                         # days to inc/dec
    format: "M/d"                   # display format (1/17, not 01/17)
    hotkey: e

  # Alternative: dynamic default via JS expression
  # EXP:
  #   type: date
  #   default: "{{ new Date(Date.now() + 2*24*60*60*1000) }}"  # 2 days from now
  #   range: 2025-01-01..2026-12-31
  #   format: "M/d"

  STRIKE:
    type: float
    default: 225.0
    range: [1.0, 9999.0]
    step: 0.5
    format: "%.1f"
    hotkey: k                 # 'k' for striKe

  TYPE:
    type: enum
    default: call
    range: [call, put]
    hotkey: t

  PRICE:
    type: float
    default: 0.50
    range: [0.01, 999.99]
    step: 0.01
    format: "$%.2f"
    hotkey: p

# ─────────────────────────────────────────────────────────────────
# COMMANDS
# ─────────────────────────────────────────────────────────────────
# Hotkey -> shell command template
# Variables are substituted using $VAR or ${VAR}
#
commands:
  # Stock quote: sq<SYMBOL><Enter>  e.g. sqTSLA<Enter>
  sq: robin shares quote $INPUT

  # Option quote
  oq: robin option quote $INPUT

  # Quick buy (uses preset variables)
  b: robin option buy "$QTY" "$SYMBOL" "$EXP" "$STRIKE" "$TYPE" limit "$PRICE"

  # Quick sell
  S: robin option sell "$QTY" "$SYMBOL" "$EXP" "$STRIKE" "$TYPE" limit "$PRICE"

  # Positions
  P: robin positions

  # Orders
  o: robin orders open
  O: robin orders all

  # Cancel order
  x: robin cancel $INPUT

# ─────────────────────────────────────────────────────────────────
# JOG WHEEL
# ─────────────────────────────────────────────────────────────────
jog:
  default: QTY              # Default variable bound to jog wheel

# ─────────────────────────────────────────────────────────────────
# ALIASES
# ─────────────────────────────────────────────────────────────────
aliases:
  fri: "1/17"
  nxt: "1/24"
  mon: "1/31"
  c: call
  p: put
```

---

### Variable Definition Schema

```yaml
variables:
  VAR_NAME:
    type: int | float | string | enum | date
    default: <value> | "{{ <js-expression> }}"  # Static or dynamic
    range: [min, max] | [val1, ...] | YYYY-MM-DD..YYYY-MM-DD
    step: <number>                      # Increment for jog/+/- (optional)
    format: "<format-string>"           # Display format (optional)
    hotkey: <key>                       # Quick-set hotkey (optional)
    validate: "<regex>"                 # Validation pattern (optional)
```

| Type     | Range Format                 | Default if omitted      | Jog/+/- Behavior                          |
|----------|------------------------------|-------------------------|-------------------------------------------|
| `int`    | `[min, max]`                 | `0`                     | Increment/decrement by `step` (default 1) |
| `float`  | `[min, max]`                 | `0.0`                   | Increment/decrement by `step`             |
| `string` | (none)                       | `""`                    | N/A (manual entry only)                   |
| `enum`   | `[val1, val2, val3, ...]`    | first value             | Rotate through values in order            |
| `date`   | `YYYY-MM-DD..YYYY-MM-DD`     | **current date**        | Increment/decrement by `step` days        |

---

### Dynamic Defaults

Defaults can be computed at runtime using JavaScript expressions wrapped in `{{ }}`:

```yaml
variables:
  # Current date (default for date type anyway)
  TODAY:
    type: date
    default: "{{ new Date() }}"
    format: "M/d"

  # Next Friday
  NEXT_FRIDAY:
    type: date
    default: |
      {{
        const d = new Date();
        d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
        d
      }}
    format: "M/d"

  # Default quantity based on env var
  QTY:
    type: int
    default: "{{ parseInt(process.env.DEFAULT_QTY) || 10 }}"
    range: [1, 100]
```

The JS expression is evaluated once at activity load time. The expression should return:
- A `Date` object for `date` type
- A number for `int`/`float` type
- A string for `string`/`enum` type

---

### Date Formatting

Date format uses a simplified pattern syntax:

| Token | Meaning          | Example      |
|-------|------------------|--------------|
| `M`   | Month (1-12)     | `1`, `12`    |
| `MM`  | Month (01-12)    | `01`, `12`   |
| `d`   | Day (1-31)       | `5`, `25`    |
| `dd`  | Day (01-31)      | `05`, `25`   |
| `yy`  | Year (2-digit)   | `25`, `26`   |
| `yyyy`| Year (4-digit)   | `2025`       |

**Format Examples:**
- `"M/d"` → `1/17`
- `"MM/dd"` → `01/17`
- `"M/d/yy"` → `1/17/25`
- `"yyyy-MM-dd"` → `2025-01-17`

---

**Validation:**
- If `validate` regex is provided, `Enter` is a no-op until value passes
- Invalid state shown in statusbar (e.g., red highlight or `[!]` indicator)
- For `date` type, value must be within `range` bounds

**Printf Format Examples (for int/float):**
- `"%d"` → `10`
- `"%.2f"` → `0.45`
- `"$%.2f"` → `$0.45`
- `"%03d"` → `010`

---

## Input Modes (REPL)

### Statusbar Layout

The statusbar is always visible at the bottom and arranged as:

```
[ACTIVITY] [COMMAND INPUT]                              [STATE]
```

| Section         | Description                                              |
|-----------------|----------------------------------------------------------|
| `[ACTIVITY]`    | Current activity name (e.g., `robin`, `git`)             |
| `[COMMAND INPUT]` | What the user is typing / current command buffer       |
| `[STATE]`       | Variable summary, jog target, validation status          |

---

### Mode Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                        NORMAL MODE                              │
│                (limbo - ignores most input)                     │
│                                                                 │
│   Press `:` ─────────────────► CMD MODE                         │
│   Press `A` ─────────────────► AGENT MODE                       │
│   Press `Tab` ───────────────► Rotate to next activity          │
│   Press `+` / `-` ───────────► Inc/dec jog-bound variable       │
│   Press var hotkey (q,s,p..) ► VAR EDIT MODE for that variable  │
│   Press cmd hotkey (b,o,x..) ► Executes mapped command          │
│                                                                 │
│   Esc from any mode ─────────► returns to NORMAL                │
└─────────────────────────────────────────────────────────────────┘
```

| Mode      | Trigger       | Purpose                                      | Exit          |
|-----------|---------------|----------------------------------------------|---------------|
| NORMAL    | (default)     | Idle state; hotkey dispatch                  | —             |
| CMD       | `:`           | Execute commands, set variables              | `Esc`/`Enter` |
| VAR EDIT  | var hotkey    | Edit a specific variable (jog/+/-/type)      | `Esc`/`Enter` |
| AGENT     | `A`           | AI agent interaction (future)                | `Esc`         |

---

### Variable Hotkeys (VAR EDIT Mode)

When a variable has a `hotkey` defined in the activity YAML, pressing that key enters **VAR EDIT mode** for that variable:

1. Press `q` → enters `:set QTY ` mode with current value shown
2. Use jog wheel CW/CCW **or** `+`/`-` keys to adjust
3. Or type a new value directly
4. Press `Enter` to apply (validated), `Esc` to cancel

This allows rapid adjustment: `q` → spin jog wheel → `Enter`

---

## REPL Mode Session Examples

### Example 1: Quick Stock Quote

**Initial screen (NORMAL mode):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         (empty viewport)                         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                                            -- NORMAL --  │
└──────────────────────────────────────────────────────────────────┘
```

**User types: `s` `q`**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         (empty viewport)                         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] sq█                                  [CMD: shares quote] │
└──────────────────────────────────────────────────────────────────┘
```

**User types: `T` `S` `L` `A`**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         (empty viewport)                         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] sqTSLA█                              [CMD: shares quote] │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Enter` — command executes:**
```
┌──────────────────────────────────────────────────────────────────┐
│ $ robin shares quote TSLA                                        │
│ TSLA: $421.35 (+2.4%)                                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                                            -- NORMAL --  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Example 2: Setting Variables and Buying Options

**User presses `:` (enters CMD mode):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :█                                                       │
└──────────────────────────────────────────────────────────────────┘
```

**User types: `set SYMBOL IWM`**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set SYMBOL IWM█                                         │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Enter`:**
```
┌──────────────────────────────────────────────────────────────────┐
│ SYMBOL=IWM                                                       │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                                    -- NORMAL --    $IWM  │
└──────────────────────────────────────────────────────────────────┘
```

**User sets more variables via `:`**
```
:set EXP 1/17
:set STRIKE 225
:set TYPE put
:set PRICE 0.45
:set QTY 5
```

**Statusbar now shows active context:**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                            5x IWM 1/17 225p @ $0.45      │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `b` (buy hotkey):**
```
┌──────────────────────────────────────────────────────────────────┐
│ $ robin option buy 5 IWM 1/17 225 put limit 0.45                 │
│ Order submitted: BUY 5x IWM 1/17 225P @ $0.45                    │
│ Order ID: abc123def456                                           │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                            5x IWM 1/17 225p @ $0.45      │
└──────────────────────────────────────────────────────────────────┘
```

---

### Example 3: Activity Switching

**User presses `Tab` to switch activity:**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [git]                                              -- NORMAL --  │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Tab` again:**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [docker]                                           -- NORMAL --  │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Tab` again (cycles back):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                                            -- NORMAL --  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Example 4: Using Jog Wheel to Adjust Quantity

**User is in NORMAL mode, jog wheel is bound to QTY:**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                    5x IWM 1/17 225p @ $0.45        [QTY] │
└──────────────────────────────────────────────────────────────────┘
```

**User rotates jog wheel CW 3 clicks (or presses `+` 3 times):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                    8x IWM 1/17 225p @ $0.45        [QTY] │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `:` then types `jog PRICE` to switch jog target:**
```
┌──────────────────────────────────────────────────────────────────┐
│ JOG -> PRICE (step: $0.01)                                       │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                    8x IWM 1/17 225p @ $0.45      [PRICE] │
└──────────────────────────────────────────────────────────────────┘
```

**User rotates jog wheel CCW 5 clicks (or presses `-` 5 times):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                    8x IWM 1/17 225p @ $0.40      [PRICE] │
└──────────────────────────────────────────────────────────────────┘
```

---

### Example 5: Quick Variable Edit via Hotkey

**User presses `q` (hotkey for QTY variable):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set QTY 8█                              -- VAR EDIT --  │
└──────────────────────────────────────────────────────────────────┘
```

**User spins jog wheel CW (or presses `+` repeatedly):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set QTY 15█                             -- VAR EDIT --  │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Enter` to apply:**
```
┌──────────────────────────────────────────────────────────────────┐
│ QTY=15                                                           │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                   15x IWM 1/17 225p @ $0.40        [QTY] │
└──────────────────────────────────────────────────────────────────┘
```

---

### Example 6: Enum Variable Rotation

**User presses `t` (hotkey for TYPE variable):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set TYPE call█                          -- VAR EDIT --  │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `+` (rotates to next enum value):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set TYPE put█                           -- VAR EDIT --  │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Enter`:**
```
┌──────────────────────────────────────────────────────────────────┐
│ TYPE=put                                                         │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                   15x IWM 1/17 225p @ $0.40              │
└──────────────────────────────────────────────────────────────────┘
```

---

### Example 7: Validation Rejection

**User presses `e` (hotkey for EXP variable):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set EXP 1/17█                           -- VAR EDIT --  │
└──────────────────────────────────────────────────────────────────┘
```

**User types invalid value: `tomorrow`**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set EXP tomorrow█                   [!] -- VAR EDIT --  │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Enter` — rejected (no-op), stays in VAR EDIT:**
```
┌──────────────────────────────────────────────────────────────────┐
│ [!] Invalid: must match ^\d{1,2}/\d{1,2}$                        │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set EXP tomorrow█                   [!] -- VAR EDIT --  │
└──────────────────────────────────────────────────────────────────┘
```

**User clears and types valid value: `1/24`**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [robin] :set EXP 1/24█                           -- VAR EDIT --  │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Enter` — accepted:**
```
┌──────────────────────────────────────────────────────────────────┐
│ EXP=1/24                                                         │
├──────────────────────────────────────────────────────────────────┤
│ [robin]                   15x IWM 1/24 225p @ $0.40              │
└──────────────────────────────────────────────────────────────────┘
```

---

## SHELL Mode Session Examples

All REPL commands have direct SHELL equivalents:

### Stock Quote
```bash
$ listy sq TSLA
TSLA: $421.35 (+2.4%)
```

### Set Variables and Execute
```bash
$ listy set SYMBOL=IWM EXP=1/17 STRIKE=225 TYPE=put PRICE=0.45 QTY=5
$ listy b
Order submitted: BUY 5x IWM 1/17 225P @ $0.45

# Or inline:
$ listy b --symbol IWM --exp 1/17 --strike 225 --type put --price 0.45 --qty 5
```

### View/Modify Variables
```bash
$ listy vars
SYMBOL=IWM
EXP=1/17
STRIKE=225
TYPE=put
PRICE=0.45
QTY=5

$ listy set QTY=10
QTY=10
```

### Pipeline Composition
```bash
# Quote multiple symbols
$ echo -e "TSLA\nAAPL\nMSFT" | xargs -I{} listy sq {}

# Cancel all open orders
$ listy orders open --ids-only | xargs -I{} listy cancel {}

# Watch positions
$ watch -n 5 'listy positions'
```

### Interactive Invocation
```bash
# Start REPL mode explicitly
$ listy repl

# Start with preset variables
$ listy repl --symbol SPY --qty 10
```

---

## Built-in Commands (CMD mode)

| Command                  | Description                                    |
|--------------------------|------------------------------------------------|
| `:set VAR VALUE`         | Set in-memory variable                         |
| `:unset VAR`             | Unset variable                                 |
| `:vars`                  | List all variables                             |
| `:jog VAR`               | Bind jog wheel to variable                     |
| `:jog step N`            | Set jog wheel step size                        |
| `:config`                | Reload config.yml                              |
| `:map KEY CMD`           | Create runtime hotkey mapping                  |
| `:unmap KEY`             | Remove hotkey mapping                          |
| `:q` / `:quit`           | Exit REPL                                      |
| `:help`                  | Show help                                      |

---

## Project Structure

```
listy/
├── package.json
├── bin/
│   └── listy.js            # Entry point (global binary)
├── src/
│   ├── index.js            # Main dispatcher
│   ├── repl/
│   │   ├── index.js        # REPL loop
│   │   ├── modes.js        # Mode state machine (NORMAL, CMD, VAR_EDIT, AGENT)
│   │   ├── statusbar.js    # Bottom statusbar rendering
│   │   ├── input.js        # Raw stdin handler
│   │   └── jog.js          # Jog wheel MIDI input handler
│   ├── shell/
│   │   └── index.js        # SHELL mode CLI parser
│   ├── config/
│   │   ├── loader.js       # YAML activity loader (reads activity/*.yml)
│   │   ├── schema.js       # Activity & variable schema validation
│   │   └── variables.js    # Variable type system (int, float, enum, string)
│   ├── commands/
│   │   ├── executor.js     # Shell command executor
│   │   └── store.js        # In-memory variable store
│   └── utils/
│       ├── template.js     # Variable substitution ($VAR, ${VAR})
│       └── validate.js     # Regex validation for variables
├── activity/               # Default activities (also ~/.config/listy/activity/)
│   ├── robin.yml           # Stock/options trading
│   ├── git.yml             # Git operations
│   └── docker.yml          # Container management
├── docs/
│   ├── CAD.md
│   ├── PROMPT.md
│   └── PLAN.md
└── test/
    └── jog-wheel.js
```

---

## Implementation Notes

### Activity Loading

On startup:
1. Read all `~/.config/listy/activity/*.yml` files
2. Parse and validate each activity against schema
3. Build activity list (sorted alphabetically by name)
4. Set first activity as current (or last-used if persisted)
5. Merge variables from current activity into runtime store

### Variable Type System

```typescript
interface VariableDefinition {
  type: 'int' | 'float' | 'string' | 'enum' | 'date';
  default?: any | string;              // value or "{{ js-expr }}"
  range?: [number, number] | string[] | string;  // bounds, enum values, or "YYYY-MM-DD..YYYY-MM-DD"
  step?: number;                        // for int/float/date (days)
  format?: string;                      // printf-style or date pattern
  hotkey?: string;                      // single char
  validate?: string;                    // regex pattern
}
```

**Default Resolution:**
1. If `default` is `"{{ ... }}"`, evaluate JS expression
2. Else if `default` is provided, use literal value
3. Else use type-specific default:
   - `int`: `0`
   - `float`: `0.0`
   - `string`: `""`
   - `enum`: first value in `range`
   - `date`: **current date** (`new Date()`)

**Adjustment Logic:**
- `+` key or jog CW: increment by `step` (or next enum value, or +N days)
- `-` key or jog CCW: decrement by `step` (or prev enum value, or -N days)
- Values are clamped to `range` bounds
- Enum values wrap around (last → first, first → last)
- Dates are clamped to range bounds (no wrap)

### Jog Wheel Integration

From `test/jog-wheel.js`, the jog wheel:
- Reads from `/dev/snd/midiC*` devices
- Sends MIDI CC messages: status `0xB0`, controller `0x0A`
- Value `0x01` = CW (clockwise), other = CCW (counter-clockwise)
- Can track velocity/speed for acceleration-based input

### CAD-Style Input Philosophy

From `docs/CAD.md`:
- Single-letter hotkeys trigger commands immediately
- Numeric input follows naturally (no field switching)
- Values appear in statusbar as typed
- `Enter` confirms, `Esc` cancels
- Support for expressions: `360/12`, `5*2.54`
- `Tab` now cycles through activities (not parameters)

### Tech Stack

- **Runtime**: Bun (for speed and native binary linking)
- **Config**: YAML (`js-yaml`)
- **Terminal UI**: Raw TTY mode via Node/Bun APIs
- **Installation**: `bun link` for global `listy` command

---

## TODO / Future

- [ ] AGENT mode implementation (AI chat integration)
- [ ] Expression parser for numeric input (`5*10`, `100/4`)
- [ ] History/undo for variable changes
- [ ] Persistent variable storage (optional)
- [ ] Activity-specific variable persistence
- [ ] Multi-jog-wheel support
- [ ] Configurable statusbar layout
- [ ] Activity search/filter (for many activities)
- [ ] Variable presets (save/load named variable snapshots)
- [ ] Remote config sync (git-based activity sharing)
