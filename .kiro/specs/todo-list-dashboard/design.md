# Design Document

## Overview

The To-Do Life Dashboard is a self-contained, client-side single-page application (SPA) built with vanilla HTML5, CSS3, and ES6+ JavaScript — no frameworks, no build tools, no network requests. The entire application is delivered as a single `index.html` file (with optional companion `style.css` and `app.js` files) that runs entirely in the browser.

The dashboard is designed to serve as a browser homepage replacement. It provides four interactive widgets:

- **Greeting Widget** — real-time clock, date display, and time-based greeting
- **Focus Timer** — 25-minute Pomodoro-style countdown with start/stop/reset controls
- **To-Do List** — full CRUD task management with persistence
- **Quick Links** — user-defined shortcut buttons to external URLs

All state is persisted to `localStorage`. There is no server, no account, and no external dependencies of any kind.

### Technology Constraints (from Requirements 9.2–9.3)

- HTML5 semantic elements
- CSS3 including Custom Properties (variables), Grid, Flexbox, `prefers-color-scheme` media query
- ES6+ JavaScript: `class`, `const`/`let`, arrow functions, template literals, `localStorage`, `setInterval`/`clearInterval`, `Date`, `JSON.stringify`/`JSON.parse`
- No third-party libraries, CDN links, or external fonts

---

## Architecture

The application follows a **widget-module pattern** — each widget is a self-contained ES6 class that manages its own DOM subtree, state, and localStorage operations. A thin `App` coordinator initialises each widget and wires up any cross-widget communication.

```
index.html
├── <link rel="stylesheet" href="style.css">
└── <script type="module" src="app.js">

app.js  (App coordinator)
├── GreetingWidget
├── FocusTimerWidget
├── TodoListWidget
└── QuickLinksWidget
```

### Data Flow

```
User Interaction
      │
      ▼
Widget Event Handler
      │
      ├─► In-memory state update
      │
      ├─► DOM re-render (targeted, not full page)
      │
      └─► localStorage.setItem(key, JSON.stringify(state))
              │
              ▼ (on page load)
        localStorage.getItem(key)
              │
              ▼
        JSON.parse → Widget.init(state)
```

All state mutations follow this unidirectional pattern: user event → state → DOM + storage.

### Module Boundaries

```
┌─────────────────────────────────────────────────┐
│                   index.html                     │
│   ┌─────────────┐   ┌──────────────────────┐    │
│   │  #greeting  │   │   #focus-timer        │    │
│   └─────────────┘   └──────────────────────┘    │
│   ┌─────────────────────────────────────────┐   │
│   │              #todo-list                  │   │
│   └─────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────┐   │
│   │             #quick-links                 │   │
│   └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

Each widget owns its root element and never touches another widget's DOM.

---

## Components and Interfaces

### App (coordinator — `app.js`)

Responsibilities:
- Instantiate all four widgets, passing their root DOM elements
- Call `widget.init()` on each during DOMContentLoaded
- No other cross-widget communication needed (widgets are independent)

```js
// app.js
import { GreetingWidget }   from './greeting.js';
import { FocusTimerWidget } from './focus-timer.js';
import { TodoListWidget }   from './todo-list.js';
import { QuickLinksWidget } from './quick-links.js';

document.addEventListener('DOMContentLoaded', () => {
  new GreetingWidget(document.getElementById('greeting')).init();
  new FocusTimerWidget(document.getElementById('focus-timer')).init();
  new TodoListWidget(document.getElementById('todo-list')).init();
  new QuickLinksWidget(document.getElementById('quick-links')).init();
});
```

> **Design decision**: ES module `<script type="module">` provides file-level scoping without any bundler. Each widget file is a self-contained module.

---

### GreetingWidget

Responsibilities:
- Display current time (HH:MM), updating every minute via `setInterval`
- Display current full date (weekday, month, day, year)
- Compute and display time-based greeting based on local hour

```js
class GreetingWidget {
  constructor(rootEl) { this.root = rootEl; }

  init() {
    this._render();
    setInterval(() => this._render(), 60_000);
  }

  _getGreeting(hour) {
    if (hour >= 5  && hour <= 11) return 'Good morning';
    if (hour >= 12 && hour <= 17) return 'Good afternoon';
    if (hour >= 18 && hour <= 21) return 'Good evening';
    return 'Good night'; // 22–23, 0–4
  }

  _render() {
    const now  = new Date();
    const hour = now.getHours();
    // Update clock, date, greeting elements
  }
}
```

**No localStorage** — time is always derived from `new Date()`.

**Timer alignment**: The interval fires every 60 seconds from widget init. The clock display is always computed fresh from `new Date()` so display drift is bounded to <60 seconds at worst. This is acceptable for a minute-resolution display.

---

### FocusTimerWidget

Responsibilities:
- Maintain countdown state: `remaining` (seconds), `running` (boolean)
- Respond to Start / Stop / Reset user controls
- Display remaining time in MM:SS format, updated every second while running
- Auto-stop at 00:00 and show a completion indicator

```js
class FocusTimerWidget {
  constructor(rootEl) {
    this.root = rootEl;
    this.remaining = 1500; // 25 * 60
    this.running   = false;
    this._interval = null;
  }

  start()  { /* guard: already running; start interval */ }
  stop()   { /* clear interval, set running=false */ }
  reset()  { /* stop, set remaining=1500 */ }

  _tick()  {
    this.remaining--;
    if (this.remaining <= 0) { this._onComplete(); }
    this._render();
  }

  _onComplete() {
    this.stop();
    // Show visual completion indicator
  }
}
```

**Timer precision**: `setInterval` is not guaranteed to fire within exactly 1 second. To stay within the 100ms tolerance requirement (Req 2.7), the widget stores the `Date.now()` timestamp when started and computes `remaining = initialRemaining - Math.round((Date.now() - startedAt) / 1000)` on each tick, rather than decrementing a counter. This prevents drift accumulation over a 25-minute session.

**No localStorage persistence for timer state** — per requirements, the timer resets to 25 minutes on load.

---

### TodoListWidget

Responsibilities:
- Maintain an ordered array of `Task` objects in memory
- Render the task list to DOM, including add/edit/delete/toggle controls
- Persist to `localStorage` after every mutating operation
- Handle localStorage write failures gracefully (Req 5.7)
- Load persisted tasks from `localStorage` on init (Req 6.1–6.3)

```js
class TodoListWidget {
  static STORAGE_KEY = 'todo-life-dashboard:tasks';

  constructor(rootEl) {
    this.root  = rootEl;
    this.tasks = []; // Task[]
  }

  init()           { this._load(); this._bindAddForm(); this._render(); }

  _load()          { /* read + JSON.parse from localStorage */ }
  _save()          { /* JSON.stringify + localStorage.setItem, with try/catch */ }
  _render()        { /* full re-render of list from this.tasks */ }

  addTask(text)    { /* validate, push Task, save, render */ }
  toggleTask(id)   { /* flip completed, save, render */ }
  deleteTask(id)   { /* splice, save, render */ }
  startEdit(id)    { /* swap display → input */ }
  saveEdit(id, text) { /* validate, update, save, render */ }
  cancelEdit(id)   { /* restore original text, render */ }
}
```

**Re-render strategy**: The list is fully re-rendered from `this.tasks` on every mutation. Given typical to-do list sizes (<100 items), this is simpler and fast enough. No virtual DOM or diffing needed.

---

### QuickLinksWidget

Responsibilities:
- Maintain an ordered array of `Link` objects in memory
- Render link buttons with associated delete controls
- Validate add form (both label and URL required)
- Open links in a new tab on click
- Persist to `localStorage` on add/delete

```js
class QuickLinksWidget {
  static STORAGE_KEY = 'todo-life-dashboard:links';

  constructor(rootEl) {
    this.root  = rootEl;
    this.links = []; // Link[]
  }

  init()           { this._load(); this._bindAddForm(); this._render(); }

  _load()          { /* read + JSON.parse */ }
  _save()          { /* JSON.stringify + setItem */ }
  _render()        { /* render link buttons + delete controls */ }

  addLink(label, url)  { /* validate both fields, push Link, save, render */ }
  deleteLink(id)       { /* splice, save, render */ }
}
```

---

## Data Models

### Task

```ts
interface Task {
  id:        string;   // crypto.randomUUID() or Date.now().toString()
  text:      string;   // non-empty, non-whitespace-only task description
  completed: boolean;  // false on creation
}
```

**Stored as**: JSON array under key `"todo-life-dashboard:tasks"`.

Example localStorage value:
```json
[
  {"id":"1720000000000","text":"Review pull request","completed":false},
  {"id":"1720000001234","text":"Write tests","completed":true}
]
```

---

### Link

```ts
interface Link {
  id:    string;  // crypto.randomUUID() or Date.now().toString()
  label: string;  // non-empty display text for the button
  url:   string;  // non-empty URL string (user-supplied, not validated against RFC)
}
```

**Stored as**: JSON array under key `"todo-life-dashboard:links"`.

Example localStorage value:
```json
[
  {"id":"1720000002000","label":"GitHub","url":"https://github.com"},
  {"id":"1720000003000","label":"MDN","url":"https://developer.mozilla.org"}
]
```

---

### localStorage Key Registry

| Key | Widget | Value type |
|-----|--------|-----------|
| `todo-life-dashboard:tasks` | TodoListWidget | `Task[]` JSON |
| `todo-life-dashboard:links` | QuickLinksWidget | `Link[]` JSON |

> **Design decision**: Keys are namespaced with the app prefix (`todo-life-dashboard:`) to avoid collisions if the page is used as a homepage alongside other pages that write to localStorage.

---

### Timer State (in-memory only)

```ts
interface TimerState {
  remaining:  number;  // seconds remaining (0–1500)
  running:    boolean; // whether the interval is active
  startedAt:  number | null; // Date.now() when last started, for drift correction
}
```

Timer state is **not persisted** — the timer always resets to 1500 seconds on page load.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Greeting classification is exhaustive and correct

*For any* integer hour in [0, 23], `_getGreeting(hour)` returns exactly one of `"Good morning"`, `"Good afternoon"`, `"Good evening"`, or `"Good night"`, with morning covering [5, 11], afternoon covering [12, 17], evening covering [18, 21], and night covering [22, 23] ∪ [0, 4].

**Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Timer display format is always MM:SS

*For any* integer seconds value in [0, 1500], the timer formatting function produces a string matching the pattern `MM:SS` (two digits, colon, two digits).

**Validates: Requirements 2.3**

### Property 3: Timer reset is always idempotent and total

*For any* timer state (any remaining value between 0 and 1500, any running status), calling `reset()` always results in `remaining === 1500` and `running === false`, regardless of the state before the call.

**Validates: Requirements 2.5**

### Property 4: Adding a valid task appends it as incomplete

*For any* non-empty, non-whitespace-only string `text`, calling `addTask(text)` on any existing task list appends exactly one new `Task` with `completed === false` and `task.text === text` to the end of the list.

**Validates: Requirements 3.2**

### Property 5: Whitespace-only task submission is always rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), calling `addTask(text)` does not modify the task list — its length and contents remain unchanged.

**Validates: Requirements 3.3**

### Property 6: Task list serialization round-trip

*For any* array of `Task` objects, serializing to JSON and then deserializing produces an array that is deeply equal to the original — all `id`, `text`, and `completed` fields are preserved.

**Validates: Requirements 6.2, 6.4**

### Property 7: Edit validation — valid text saves, whitespace discards

*For any* task `T` and any candidate string `s`: if `s` contains at least one non-whitespace character, then `saveEdit(T.id, s)` updates `T.text` to `s`; if `s` is whitespace-only, then `saveEdit(T.id, s)` leaves `T.text` unchanged.

**Validates: Requirements 4.3, 4.4**

### Property 8: Toggle completion is a round-trip (involution)

*For any* task `T`, calling `toggleTask(T.id)` twice in succession restores `T.completed` to its original value.

**Validates: Requirements 5.2, 5.3**

### Property 9: Delete removes exactly the targeted task

*For any* task list containing task `T`, calling `deleteTask(T.id)` produces a list that does not contain `T` and retains all other tasks in their original order.

**Validates: Requirements 5.5**

### Property 10: Quick-links serialization round-trip

*For any* array of `Link` objects, serializing to JSON and then deserializing produces an array that is deeply equal to the original — all `id`, `label`, and `url` fields are preserved.

**Validates: Requirements 8.5**

### Property 11: Adding a valid link with non-empty label and URL appends it

*For any* non-empty label string and non-empty URL string, calling `addLink(label, url)` appends exactly one new `Link` with matching `label` and `url` to the link list.

**Validates: Requirements 7.2**

### Property 12: Adding a link with empty label or URL is always rejected

*For any* call to `addLink(label, url)` where either `label` or `url` is empty, the link list remains unchanged and a validation message is produced.

**Validates: Requirements 7.5**

---

### Property 1: Greeting is correct for every hour of the day

*For any* integer hour in [0, 23], `_getGreeting(hour)` SHALL return exactly one of the four valid greeting strings (`"Good morning"`, `"Good afternoon"`, `"Good evening"`, `"Good night"`), and the returned greeting SHALL correspond to the correct time range: [5–11] → morning, [12–17] → afternoon, [18–21] → evening, [22–23, 0–4] → night.

**Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**

---

### Property 2: Time format is valid HH:MM for any Date

*For any* `Date` object, the time-formatting function SHALL produce a string matching `HH:MM` with zero-padded two-digit hours (00–23) and two-digit minutes (00–59), correctly reflecting the date's local hour and minute values.

**Validates: Requirements 1.1**

---

### Property 3: Timer MM:SS format is valid for any second count

*For any* integer `seconds` in [0, 1500], the timer-formatting function SHALL produce a string matching `MM:SS` with zero-padded two-digit minutes and two-digit seconds, correctly representing the total second count as `Math.floor(seconds/60)` minutes and `seconds % 60` seconds.

**Validates: Requirements 2.3**

---

### Property 4: Reset always restores timer to 1500 seconds

*For any* timer state (any `remaining` value in [0, 1500], any `running` value), calling `reset()` SHALL set `remaining` to 1500 and `running` to `false`.

**Validates: Requirements 2.5**

---

### Property 5: Adding a valid task grows the task list and stores the correct data

*For any* task list and any non-empty, non-whitespace-only string `text`, calling `addTask(text)` SHALL: (a) increase the task list length by exactly 1, (b) append a task with `text` equal to the provided string and `completed === false`, and (c) leave all previously existing tasks unchanged.

**Validates: Requirements 3.2**

---

### Property 6: Whitespace-only and empty inputs are rejected for tasks

*For any* string composed entirely of whitespace characters (including the empty string `""`), calling `addTask(text)` SHALL leave the task list completely unchanged (same length, same items).

**Validates: Requirements 3.3**

---

### Property 7: Task persistence invariant — localStorage matches in-memory state after every mutation

*For any* sequence of task mutations (add, edit, toggle, delete), after each individual operation the value stored in `localStorage` under `"todo-life-dashboard:tasks"` SHALL be a valid JSON array that is deeply equal to the current in-memory `tasks` array.

**Validates: Requirements 3.4, 4.5, 5.6**

---

### Property 8: Edit with valid text updates the task description

*For any* task in the list and any non-empty, non-whitespace-only string `newText`, calling `saveEdit(id, newText)` SHALL update that task's `text` to `newText` while leaving all other tasks and the task's `completed` status unchanged.

**Validates: Requirements 4.3**

---

### Property 9: Edit with whitespace-only text discards the change

*For any* task with description `originalText` and any whitespace-only string `badText`, calling `saveEdit(id, badText)` SHALL leave the task's `text` equal to `originalText` (unchanged) and not corrupt the task list.

**Validates: Requirements 4.4**

---

### Property 10: Toggle completion is an involution (round-trip)

*For any* task with `completed` status `c`, toggling the task twice SHALL restore `completed` to `c` — i.e., `toggle(toggle(task)).completed === task.completed`. Additionally, a single toggle on an incomplete task yields `completed === true`, and a single toggle on a complete task yields `completed === false`.

**Validates: Requirements 5.2, 5.3**

---

### Property 11: Delete removes exactly the target task, preserving all others

*For any* task list containing at least one task, and any valid `id` in that list, calling `deleteTask(id)` SHALL: (a) remove exactly the task with that `id`, (b) leave all other tasks present and unchanged, and (c) reduce the list length by exactly 1.

**Validates: Requirements 5.5**

---

### Property 12: Task serialization round-trip

*For any* array of `Task` objects (with any combination of `id`, `text`, and `completed` values), `JSON.parse(JSON.stringify(tasks))` SHALL produce an array that is deeply equal to the original — every field of every task is preserved.

**Validates: Requirements 6.4**

---

### Property 13: Task list loads from localStorage in saved order

*For any* array of `Task` objects pre-populated in `localStorage` under the tasks key, calling `init()` on a fresh `TodoListWidget` SHALL produce an in-memory `tasks` array that is deeply equal to the stored array, preserving order.

**Validates: Requirements 6.1**

---

### Property 14: Adding a valid link grows the links list and stores the correct data

*For any* links list and any non-empty strings `label` and `url`, calling `addLink(label, url)` SHALL: (a) increase the links list length by exactly 1, (b) append a link with the correct `label` and `url`, and (c) leave all previously existing links unchanged.

**Validates: Requirements 7.2**

---

### Property 15: Invalid link form inputs are rejected

*For any* `(label, url)` pair where either `label` or `url` is an empty or whitespace-only string, calling `addLink(label, url)` SHALL leave the links list completely unchanged.

**Validates: Requirements 7.5**

---

### Property 16: Delete link removes exactly the target link, preserving all others

*For any* links list containing at least one link, and any valid `id` in that list, calling `deleteLink(id)` SHALL remove exactly that link and leave all others unchanged, and update `localStorage` to reflect the new state.

**Validates: Requirements 8.2**

---

### Property 17: Link serialization round-trip

*For any* array of `Link` objects, `JSON.parse(JSON.stringify(links))` SHALL produce an array that is deeply equal to the original — every `id`, `label`, and `url` field is preserved.

**Validates: Requirements 8.5**

---

### Property 18: Link list loads from localStorage in saved order

*For any* array of `Link` objects pre-populated in `localStorage` under the links key, calling `init()` on a fresh `QuickLinksWidget` SHALL produce an in-memory `links` array that is deeply equal to the stored array, preserving order.

**Validates: Requirements 8.3**

---

## Error Handling

### localStorage Write Failures (Req 5.7)

All `_save()` methods wrap `localStorage.setItem` in a `try/catch`:

```js
_save() {
  try {
    localStorage.setItem(TodoListWidget.STORAGE_KEY, JSON.stringify(this.tasks));
  } catch (err) {
    // Storage quota exceeded or security restriction
    this._showError('Could not save your tasks. Storage may be full.');
  }
}
```

The in-memory operation always completes first. If saving fails, the UI shows a non-blocking error banner that auto-dismisses after a few seconds. The in-memory state remains updated, so the user's current session is unaffected.

### localStorage Read Failures on Load

If `JSON.parse` throws (corrupted storage value), the widget catches the error, clears the corrupt key, and starts with an empty list:

```js
_load() {
  try {
    const raw = localStorage.getItem(this.constructor.STORAGE_KEY);
    this.tasks = raw ? JSON.parse(raw) : [];
  } catch {
    localStorage.removeItem(this.constructor.STORAGE_KEY);
    this.tasks = [];
  }
}
```

### Empty/Missing localStorage Data (Req 6.3, 8.4)

If `localStorage.getItem` returns `null` (key not set), widgets initialize with an empty array — no error, no crash. This is the expected first-run state.

### Timer Edge Cases

- **Start when already running**: guard prevents creating duplicate intervals
- **Stop when not running**: no-op, no error
- **Reset clears any active interval**: always safe to call

### Input Validation Errors (Req 3.3, 7.5)

Invalid inputs (empty/whitespace task text, missing link label/url) are caught at the handler level before any state mutation. The input field retains focus and, for Quick Links, an inline validation message is shown.

---

## Testing Strategy

### PBT Applicability Assessment

This feature is well-suited for property-based testing because:
- Core logic functions (`_getGreeting`, `formatTime`, `formatDate`, `addTask`, `deleteTask`, `toggleTask`, `saveEdit`, `addLink`, `deleteLink`, serialization round-trips) are **pure or near-pure functions** with clear input/output behavior
- The input spaces are large (arbitrary strings, arbitrary time values, arbitrary arrays of Tasks/Links)
- Universal properties (round-trips, invariants, rejection of invalid inputs) hold across all valid inputs
- All logic can be tested in-memory with a mocked `localStorage`, keeping tests fast and free of I/O

**PBT library**: [fast-check](https://github.com/dubzzz/fast-check) (JavaScript, runs in Node.js with any test runner)

### Dual Testing Approach

#### Unit / Example-Based Tests

Test specific structural and behavioral examples:
- DOM structure after `init()` (input fields, buttons present)
- Timer initializes to 1500 seconds
- `window.open` called with correct URL and `'_blank'` on link click
- localStorage cleared on corrupt data load
- Error banner shown when localStorage.setItem throws
- Dark mode CSS variable applied when `prefers-color-scheme: dark` matches

#### Property-Based Tests

Each correctness property from the Correctness Properties section maps to one property-based test. Configuration:

- **Minimum 100 iterations** per property test (fast-check default is 100, set `numRuns: 100` minimum)
- **Arbitrary generators** used: `fc.integer`, `fc.string`, `fc.boolean`, `fc.array`, `fc.record`, `fc.constantFrom`, `fc.oneof`
- **localStorage mock**: Use a `Map`-backed mock to avoid real browser storage in Node tests
- Each test is tagged with a comment referencing its design property:
  ```js
  // Feature: todo-life-dashboard, Property 1: Greeting is correct for every hour of the day
  ```

Property test tag format: **`Feature: todo-life-dashboard, Property N: <property title>`**

#### Property Test Mapping

| Property | Test Description | Key Generators |
|----------|-----------------|----------------|
| P1 | Greeting correct for all hours | `fc.integer({ min: 0, max: 23 })` |
| P2 | Time formatted as HH:MM | `fc.date()` (or `fc.integer` for hour/minute) |
| P3 | Timer formatted as MM:SS | `fc.integer({ min: 0, max: 1500 })` |
| P4 | Reset always → 1500, not running | `fc.integer({ min: 0, max: 1500 })`, `fc.boolean()` |
| P5 | Add valid task → list grows by 1 | `fc.string().filter(s => s.trim().length > 0)`, task array |
| P6 | Add whitespace → list unchanged | `fc.stringOf(fc.constantFrom(' ','\t','\n'))` |
| P7 | Persistence invariant after mutations | Sequence of random task mutations |
| P8 | Edit valid text → task updated | `fc.string().filter(s => s.trim().length > 0)` |
| P9 | Edit whitespace → task unchanged | `fc.stringOf(fc.constantFrom(' ','\t','\n'))` |
| P10 | Toggle is involution | Task array with random completed values |
| P11 | Delete removes exactly one task | `fc.array(taskArbitrary, { minLength: 1 })` |
| P12 | Task round-trip serialization | `fc.array(taskArbitrary)` |
| P13 | Tasks load from storage in order | `fc.array(taskArbitrary)` |
| P14 | Add valid link → links grows by 1 | `fc.string().filter(s => s.trim().length > 0)` × 2 |
| P15 | Invalid link inputs rejected | `fc.oneof(emptyStr, whitespaceStr)` |
| P16 | Delete link removes exactly one | `fc.array(linkArbitrary, { minLength: 1 })` |
| P17 | Link round-trip serialization | `fc.array(linkArbitrary)` |
| P18 | Links load from storage in order | `fc.array(linkArbitrary)` |

#### Integration / Smoke Tests

- Manual: Verify dashboard loads and all four widgets render in Chrome, Firefox, Edge, Safari (Req 9.1)
- Manual: Verify no console errors on first load with empty localStorage
- Manual: Verify dark mode palette applies when OS dark mode is active (Req 10.5)
- Manual: Verify responsive layout at 360px, 768px, 1920px viewport widths (Req 10.4)

### Test File Structure

```
src/
├── greeting.js
├── focus-timer.js
├── todo-list.js
├── quick-links.js
└── app.js

test/
├── greeting.test.js      # P1, P2 + unit tests for init
├── focus-timer.test.js   # P3, P4 + unit tests for start/stop
├── todo-list.test.js     # P5–P13 + unit tests for DOM structure, error handling
└── quick-links.test.js   # P14–P18 + unit tests for window.open, validation messages
```

Run with: `npx vitest --run` (or `node --test` with Node 18+ test runner)
