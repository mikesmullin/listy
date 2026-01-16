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

## Configuration: `config.yml`

```yaml
# ~/.config/listy/config.yml

# Variable defaults (can be overridden at runtime via :set)
defaults:
  QTY: 10
  SYMBOL: SPY
  TYPE: call

# Hotkey mappings
# Format: key -> command template (variables use $VAR or ${VAR})
commands:
  # ===== Stock Quotes =====
  # Usage: sq<SYMBOL><Enter>  e.g. sqTSLA<Enter>
  sq: robin shares quote $INPUT

  # ===== Option Quote =====
  # Usage: oq<SYMBOL> <EXP> <STRIKE> <TYPE><Enter>
  oq: robin option quote $INPUT

  # ===== Quick Buy (uses preset variables) =====
  b: robin option buy "$QTY" "$SYMBOL" "$EXP" "$STRIKE" "$TYPE" limit "$PRICE"

  # ===== Quick Sell =====
  s: robin option sell "$QTY" "$SYMBOL" "$EXP" "$STRIKE" "$TYPE" limit "$PRICE"

  # ===== Positions =====
  p: robin positions $INPUT
  P: robin positions

  # ===== Orders =====
  o: robin orders open
  O: robin orders all

  # ===== Cancel Order =====
  x: robin cancel $INPUT

# Jog wheel bindings
# Maps jog wheel CW/CCW to increment/decrement actions on variables
jog:
  default: QTY          # Which variable the jog wheel modifies by default
  step: 1               # Increment/decrement step size
  # Context-specific overrides (when in certain input states)
  contexts:
    price:
      variable: PRICE
      step: 0.01
    strike:
      variable: STRIKE
      step: 0.5

# Aliases for common values
aliases:
  # Expiration shortcuts
  fri: "1/17"           # This Friday
  nxt: "1/24"           # Next Friday
  mon: "1/31"           # Monthly

  # Type shortcuts
  c: call
  p: put
```

---

## Input Modes (REPL)

### Mode Transitions

```
┌─────────────────────────────────────────────────────────┐
│                      NORMAL MODE                        │
│              (limbo - ignores most input)               │
│                                                         │
│   Press `:` ───────────────► CMD MODE                   │
│   Press `A` ───────────────► AGENT MODE                 │
│   Press hotkey (a-z) ──────► executes mapped command    │
│                                                         │
│   Esc from any mode ───────► returns to NORMAL          │
└─────────────────────────────────────────────────────────┘
```

| Mode     | Trigger | Purpose                                      | Exit     |
|----------|---------|----------------------------------------------|----------|
| NORMAL   | (default) | Idle state; hotkey dispatch                | —        |
| CMD      | `:`     | Execute commands, set variables              | `Esc`/`Enter` |
| AGENT    | `A`     | AI agent interaction (future)                | `Esc`    |

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
│ -- NORMAL --                                                     │
└──────────────────────────────────────────────────────────────────┘
```

**User types: `s` `q`**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         (empty viewport)                         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ sq█                                          [CMD: shares quote] │
└──────────────────────────────────────────────────────────────────┘
```

**User types: `T` `S` `L` `A`**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         (empty viewport)                         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ sqTSLA█                                      [CMD: shares quote] │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Enter` — command executes:**
```
┌──────────────────────────────────────────────────────────────────┐
│ $ robin shares quote TSLA                                        │
│ TSLA: $421.35 (+2.4%)                                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ -- NORMAL --                                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

### Example 2: Setting Variables and Buying Options

**User presses `:` (enters CMD mode):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ :█                                                               │
└──────────────────────────────────────────────────────────────────┘
```

**User types: `set SYMBOL IWM`**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ :set SYMBOL IWM█                                                 │
└──────────────────────────────────────────────────────────────────┘
```

**User presses `Enter`:**
```
┌──────────────────────────────────────────────────────────────────┐
│ SYMBOL=IWM                                                       │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ -- NORMAL --                                              $IWM   │
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
│ -- NORMAL --                    5x IWM 1/17 225p @ $0.45         │
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
│ -- NORMAL --                    5x IWM 1/17 225p @ $0.45         │
└──────────────────────────────────────────────────────────────────┘
```

---

### Example 3: Using Jog Wheel to Adjust Quantity

**User is in NORMAL mode, jog wheel is bound to QTY:**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ -- NORMAL --                    5x IWM 1/17 225p @ $0.45    [QTY]│
└──────────────────────────────────────────────────────────────────┘
```

**User rotates jog wheel CW 3 clicks:**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ -- NORMAL --                    8x IWM 1/17 225p @ $0.45    [QTY]│
└──────────────────────────────────────────────────────────────────┘
```

**User presses `:` then types `jog PRICE` to switch jog target:**
```
┌──────────────────────────────────────────────────────────────────┐
│ JOG -> PRICE (step: $0.01)                                       │
├──────────────────────────────────────────────────────────────────┤
│ -- NORMAL --                    8x IWM 1/17 225p @ $0.45  [PRICE]│
└──────────────────────────────────────────────────────────────────┘
```

**User rotates jog wheel CCW 5 clicks (decreases price):**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ -- NORMAL --                    8x IWM 1/17 225p @ $0.40  [PRICE]│
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
│   │   ├── modes.js        # Mode state machine (NORMAL, CMD, AGENT)
│   │   ├── statusbar.js    # Bottom statusbar rendering
│   │   ├── input.js        # Raw stdin handler
│   │   └── jog.js          # Jog wheel MIDI input handler
│   ├── shell/
│   │   └── index.js        # SHELL mode CLI parser
│   ├── config/
│   │   ├── loader.js       # YAML config loader
│   │   └── schema.js       # Config validation
│   ├── commands/
│   │   ├── executor.js     # Shell command executor
│   │   └── variables.js    # In-memory variable store
│   └── utils/
│       └── template.js     # Variable substitution ($VAR, ${VAR})
├── config.yml              # Default config (also ~/.config/listy/config.yml)
├── docs/
│   ├── CAD.md
│   ├── PROMPT.md
│   └── PLAN.md
└── test/
    └── jog-wheel.js
```

---

## Implementation Notes

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
- `Tab` could cycle through parameters

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
- [ ] Tab completion for symbols/commands
- [ ] Multi-jog-wheel support
- [ ] Configurable statusbar layout
