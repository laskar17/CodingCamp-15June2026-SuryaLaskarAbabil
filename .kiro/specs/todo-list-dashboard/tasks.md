# Implementation Plan: To-Do Life Dashboard

## Overview

Build a self-contained, client-side single-page application using vanilla HTML5, CSS3, and ES6+ JavaScript (no frameworks, no build tools, no external dependencies). The app delivers four widgets — Greeting, Focus Timer, To-Do List, and Quick Links — wired together by a thin App coordinator, with all user state persisted to `localStorage`. A property-based test suite using `fast-check` covers all 18 correctness properties, run with `vitest`.

---

## Tasks

- [x] 1. Scaffold project structure, HTML shell, and test harness
  - Create `index.html` with semantic sectioning: `<header id="greeting">`, `<section id="focus-timer">`, `<section id="todo-list">`, `<section id="quick-links">`; link `style.css` and `<script type="module" src="app.js">`
  - Create empty module stubs: `src/greeting.js`, `src/focus-timer.js`, `src/todo-list.js`, `src/quick-links.js`, `src/app.js`
  - Create `package.json` with `vitest` and `fast-check` as `devDependencies` (exact versions); add `"test": "vitest --run"` script
  - Create empty test files: `test/greeting.test.js`, `test/focus-timer.test.js`, `test/todo-list.test.js`, `test/quick-links.test.js`
  - Create `vitest.config.js` configuring the `jsdom` environment for DOM tests
  - _Requirements: 9.2, 9.3_

- [x] 2. Implement GreetingWidget
  - [x] 2.1 Implement `GreetingWidget` class in `src/greeting.js`
    - Export `class GreetingWidget` with `constructor(rootEl)`, `init()`, `_getGreeting(hour)`, `_formatTime(date)`, `_formatDate(date)`, and `_render()`
    - `init()` calls `_render()` immediately and schedules `setInterval(() => this._render(), 60_000)`
    - `_getGreeting(hour)`: `[5–11]` → `"Good morning"`, `[12–17]` → `"Good afternoon"`, `[18–21]` → `"Good evening"`, `[22–23, 0–4]` → `"Good night"`
    - `_formatTime(date)`: returns `HH:MM` with zero-padded hours and minutes from `date.getHours()` / `date.getMinutes()`
    - `_formatDate(date)`: returns full weekday, month, day, year using `toLocaleDateString`
    - `_render()`: constructs `new Date()`, updates `#greeting` subtree elements for clock, date, and greeting text
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 2.2 Write property test — P1: Greeting correct for every hour
    - `// Feature: todo-life-dashboard, Property 1: Greeting is correct for every hour of the day`
    - Use `fc.integer({ min: 0, max: 23 })`; assert exactly one of the four strings is returned and the correct range is respected
    - **Property 1 — Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**

  - [ ]* 2.3 Write property test — P2: Time formatted as HH:MM for any Date
    - `// Feature: todo-life-dashboard, Property 2: Time format is valid HH:MM for any Date`
    - Use `fc.integer({ min: 0, max: 23 })` and `fc.integer({ min: 0, max: 59 })` to construct synthetic date-like objects; assert output matches `/^\d{2}:\d{2}$/` and values reflect correct hour/minute
    - **Property 2 — Validates: Requirements 1.1**

  - [ ]* 2.4 Write unit tests for GreetingWidget init
    - Assert `#greeting` subtree contains clock, date, and greeting elements after `init()`
    - Assert `setInterval` is called once during `init()`

- [x] 3. Implement FocusTimerWidget
  - [x] 3.1 Implement `FocusTimerWidget` class in `src/focus-timer.js`
    - Export `class FocusTimerWidget` with `constructor(rootEl)`, `init()`, `start()`, `stop()`, `reset()`, `_tick()`, `_formatTime(seconds)`, `_onComplete()`, and `_render()`
    - Initial state: `this.remaining = 1500`, `this.running = false`, `this._interval = null`, `this._startedAt = null`
    - `_formatTime(seconds)`: zero-pad `Math.floor(seconds / 60)` and `seconds % 60` to produce `MM:SS`
    - `start()`: guard if already running; record `this._startedAt = Date.now()` and store initial remaining; create `setInterval` that calls `_tick()` every 1000ms
    - `_tick()`: compute `elapsed = Math.round((Date.now() - this._startedAt) / 1000)`, set `this.remaining = Math.max(0, initialRemaining - elapsed)`; if `remaining <= 0` call `_onComplete()`; call `_render()`
    - `stop()`: `clearInterval`, set `this.running = false`, `this._interval = null`
    - `reset()`: call `stop()`, set `this.remaining = 1500`, `this._startedAt = null`, call `_render()`
    - `_onComplete()`: call `stop()`, display visual completion indicator (add CSS class or element)
    - Bind Start / Stop / Reset button click handlers in `init()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.2 Write property test — P3: Timer MM:SS format valid for any second count
    - `// Feature: todo-life-dashboard, Property 3: Timer MM:SS format is valid for any second count`
    - Use `fc.integer({ min: 0, max: 1500 })`; assert output matches `/^\d{2}:\d{2}$/`, correct minutes, correct seconds
    - **Property 3 — Validates: Requirements 2.3**

  - [ ]* 3.3 Write property test — P4: Reset always restores 1500 seconds
    - `// Feature: todo-life-dashboard, Property 4: Reset always restores timer to 1500 seconds`
    - Use `fc.integer({ min: 0, max: 1500 })` and `fc.boolean()` to set arbitrary `remaining` and `running`; call `reset()`; assert `remaining === 1500` and `running === false`
    - **Property 4 — Validates: Requirements 2.5**

  - [ ]* 3.4 Write unit tests for FocusTimerWidget
    - Assert timer initializes to 1500 seconds and renders `25:00`
    - Assert `start()` when already running does not create duplicate intervals
    - Assert `stop()` when not running is a no-op
    - Assert `_onComplete()` is called and completion indicator is shown when countdown reaches zero

- [x] 4. Implement TodoListWidget — core CRUD and persistence
  - [x] 4.1 Implement `TodoListWidget` class skeleton and localStorage helpers in `src/todo-list.js`
    - Export `class TodoListWidget` with `static STORAGE_KEY = 'todo-life-dashboard:tasks'`
    - Implement `_load()`: `try { const raw = localStorage.getItem(…); this.tasks = raw ? JSON.parse(raw) : []; } catch { localStorage.removeItem(…); this.tasks = []; }`
    - Implement `_save()`: wrap `localStorage.setItem(…, JSON.stringify(this.tasks))` in `try/catch`; on error call `this._showError('Could not save your tasks. Storage may be full.')`
    - Implement `_showError(msg)`: insert a non-blocking banner into the widget root that auto-dismisses after 4 seconds
    - Task IDs generated via `crypto.randomUUID()` (with `Date.now().toString()` fallback)
    - _Requirements: 3.4, 5.6, 5.7, 6.1, 6.2, 6.3_

  - [x] 4.2 Implement `addTask`, `toggleTask`, `deleteTask`, `startEdit`, `saveEdit`, `cancelEdit`
    - `addTask(text)`: if `text.trim().length === 0` return without mutation; push `{ id, text, completed: false }`, call `_save()`, call `_render()`
    - `toggleTask(id)`: flip `task.completed`, call `_save()`, call `_render()`
    - `deleteTask(id)`: remove task by id, call `_save()`, call `_render()`
    - `startEdit(id)`: replace task row display text with a pre-filled `<input>` and Save/Cancel controls
    - `saveEdit(id, text)`: if `text.trim().length === 0` call `cancelEdit(id)` instead; otherwise update `task.text`, call `_save()`, call `_render()`
    - `cancelEdit(id)`: call `_render()` to restore original display
    - _Requirements: 3.2, 3.3, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3, 5.5_

  - [x] 4.3 Implement `_render()` and `_bindAddForm()` for TodoListWidget
    - `_render()`: clear the task list container, re-render all tasks from `this.tasks`; each row has: checkbox toggle, task text span (with strikethrough class when `completed`), Edit button, Delete button
    - `_bindAddForm()`: wire the Add form's submit event (and Enter keypress) to `addTask(inputEl.value)` then clear and refocus the input
    - When add is rejected (empty input), retain focus on input field per Req 3.3
    - Bind delegated or per-row click handlers for toggle, delete, edit, save, cancel
    - `init()` calls `_load()`, `_bindAddForm()`, `_render()`
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.4, 6.1, 6.3_

  - [ ]* 4.4 Write property test — P5: Adding valid task grows list by 1
    - `// Feature: todo-life-dashboard, Property 5: Adding a valid task grows the task list and stores the correct data`
    - Use `fc.string().filter(s => s.trim().length > 0)` and `fc.array(taskArbitrary)` as pre-existing list; assert length +1, appended task has correct `text` and `completed === false`, prior tasks unchanged
    - **Property 5 — Validates: Requirements 3.2**

  - [ ]* 4.5 Write property test — P6: Whitespace-only inputs rejected
    - `// Feature: todo-life-dashboard, Property 6: Whitespace-only and empty inputs are rejected for tasks`
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))` including empty string; assert task list length and contents unchanged
    - **Property 6 — Validates: Requirements 3.3**

  - [ ]* 4.6 Write property test — P7: Persistence invariant after every mutation
    - `// Feature: todo-life-dashboard, Property 7: Task persistence invariant — localStorage matches in-memory state after every mutation`
    - Simulate random sequence of `addTask`, `toggleTask`, `deleteTask`, `saveEdit`; after each operation assert `JSON.parse(mockStorage.getItem(KEY))` deeply equals `widget.tasks`
    - Use a `Map`-backed localStorage mock
    - **Property 7 — Validates: Requirements 3.4, 4.5, 5.6**

  - [ ]* 4.7 Write property test — P8: Edit with valid text updates task description
    - `// Feature: todo-life-dashboard, Property 8: Edit with valid text updates the task description`
    - Use `fc.string().filter(s => s.trim().length > 0)`; assert target task's `text` is updated, `completed` unchanged, all other tasks untouched
    - **Property 8 — Validates: Requirements 4.3**

  - [ ]* 4.8 Write property test — P9: Edit with whitespace discards change
    - `// Feature: todo-life-dashboard, Property 9: Edit with whitespace-only text discards the change`
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))`; assert original `text` is preserved
    - **Property 9 — Validates: Requirements 4.4**

  - [ ]* 4.9 Write property test — P10: Toggle is an involution
    - `// Feature: todo-life-dashboard, Property 10: Toggle completion is an involution (round-trip)`
    - Use `fc.array(taskArbitrary)` with random `completed` values; toggle twice, assert restored to original; also assert single-toggle flips correctly
    - **Property 10 — Validates: Requirements 5.2, 5.3**

  - [ ]* 4.10 Write property test — P11: Delete removes exactly the target task
    - `// Feature: todo-life-dashboard, Property 11: Delete removes exactly the target task, preserving all others`
    - Use `fc.array(taskArbitrary, { minLength: 1 })`; pick random task; assert length -1, target absent, all others present in original order
    - **Property 11 — Validates: Requirements 5.5**

  - [ ]* 4.11 Write property test — P12: Task serialization round-trip
    - `// Feature: todo-life-dashboard, Property 12: Task serialization round-trip`
    - Use `fc.array(taskArbitrary)`; assert `JSON.parse(JSON.stringify(tasks))` deeply equals original
    - **Property 12 — Validates: Requirements 6.4**

  - [ ]* 4.12 Write property test — P13: Tasks load from localStorage in saved order
    - `// Feature: todo-life-dashboard, Property 13: Task list loads from localStorage in saved order`
    - Use `fc.array(taskArbitrary)`; pre-populate mock localStorage; call `init()` on fresh widget; assert `widget.tasks` deeply equals stored array in order
    - **Property 13 — Validates: Requirements 6.1**

  - [ ]* 4.13 Write unit tests for TodoListWidget error and edge cases
    - Assert corrupt localStorage value results in empty list and clears the key
    - Assert `_showError` banner appears when `localStorage.setItem` throws (mock quota error)
    - Assert DOM has checkbox, text, edit, and delete controls per task after `_render()`

- [~] 5. Checkpoint — run all tests so far
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement QuickLinksWidget — add, delete, and persistence
  - [x] 6.1 Implement `QuickLinksWidget` class skeleton and localStorage helpers in `src/quick-links.js`
    - Export `class QuickLinksWidget` with `static STORAGE_KEY = 'todo-life-dashboard:links'`
    - Implement `_load()` and `_save()` mirroring TodoListWidget patterns (JSON parse/stringify, try/catch, clear-on-corrupt)
    - Link IDs generated via `crypto.randomUUID()` (with `Date.now().toString()` fallback)
    - _Requirements: 7.4, 8.3, 8.4, 8.5_

  - [x] 6.2 Implement `addLink`, `deleteLink`, `_render()`, and `_bindAddForm()`
    - `addLink(label, url)`: if either `label.trim()` or `url.trim()` is empty, show inline validation message identifying the missing field, do not mutate; otherwise push `{ id, label, url }`, call `_save()`, call `_render()`
    - `deleteLink(id)`: remove link by id, call `_save()`, call `_render()`
    - `_render()`: clear links container; for each link render a `<button>` (label text) that calls `window.open(link.url, '_blank')` on click, plus a Delete control
    - `_bindAddForm()`: wire form submit to `addLink(labelInput.value, urlInput.value)`; clear inputs on success
    - `init()` calls `_load()`, `_bindAddForm()`, `_render()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2_

  - [ ]* 6.3 Write property test — P14: Adding valid link grows list by 1
    - `// Feature: todo-life-dashboard, Property 14: Adding a valid link grows the links list and stores the correct data`
    - Use `fc.string().filter(s => s.trim().length > 0)` for both label and url; assert length +1, correct `label` and `url`, prior links unchanged
    - **Property 14 — Validates: Requirements 7.2**

  - [ ]* 6.4 Write property test — P15: Invalid link inputs rejected
    - `// Feature: todo-life-dashboard, Property 15: Invalid link form inputs are rejected`
    - Use `fc.oneof(fc.constant(''), fc.stringOf(fc.constantFrom(' ', '\t', '\n')))` for empty/whitespace label or url; assert links list unchanged
    - **Property 15 — Validates: Requirements 7.5**

  - [ ]* 6.5 Write property test — P16: Delete link removes exactly the target
    - `// Feature: todo-life-dashboard, Property 16: Delete link removes exactly the target link, preserving all others`
    - Use `fc.array(linkArbitrary, { minLength: 1 })`; pick random link; assert length -1, target absent, all others present, localStorage updated
    - **Property 16 — Validates: Requirements 8.2**

  - [ ]* 6.6 Write property test — P17: Link serialization round-trip
    - `// Feature: todo-life-dashboard, Property 17: Link serialization round-trip`
    - Use `fc.array(linkArbitrary)`; assert `JSON.parse(JSON.stringify(links))` deeply equals original
    - **Property 17 — Validates: Requirements 8.5**

  - [ ]* 6.7 Write property test — P18: Links load from localStorage in saved order
    - `// Feature: todo-life-dashboard, Property 18: Link list loads from localStorage in saved order`
    - Use `fc.array(linkArbitrary)`; pre-populate mock localStorage; call `init()` on fresh widget; assert `widget.links` deeply equals stored array in order
    - **Property 18 — Validates: Requirements 8.3**

  - [ ]* 6.8 Write unit tests for QuickLinksWidget
    - Assert `window.open` called with correct URL and `'_blank'` on link button click
    - Assert inline validation message shown when label or URL is missing
    - Assert corrupt localStorage cleared and starts empty

- [ ] 7. Wire the App coordinator and complete `index.html`
  - [~] 7.1 Implement `src/app.js` coordinator
    - Import all four widget classes; in `DOMContentLoaded` handler instantiate each with its root element and call `.init()`
    - Ensure widget IDs in HTML match: `#greeting`, `#focus-timer`, `#todo-list`, `#quick-links`
    - _Requirements: 9.2, 9.3_

  - [~] 7.2 Complete `index.html` semantic structure
    - Add all widget root elements with correct `id` attributes and semantic HTML5 tags (`<header>`, `<section>`, `<main>`, `<form>`, `<button>`, `<input>`, `<ul>`)
    - Add ARIA labels/roles where needed for accessibility
    - No external fonts, CDN links, or network requests
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 8. Implement `style.css` — layout, typography, dark mode, and responsive design
  - [~] 8.1 Implement CSS custom properties, grid/flex layout, and typography
    - Define light-mode CSS custom properties (`--bg`, `--surface`, `--text`, `--accent`, etc.) on `:root`
    - Use CSS Grid for the four-widget dashboard layout (greeting + timer in top row, todo + links below); all four widgets fit within 768px viewport height without vertical scroll
    - Font sizes: minimum `14px` for body text, minimum `24px` for the clock display
    - _Requirements: 10.1, 10.2, 10.3_

  - [~] 8.2 Implement dark mode via `prefers-color-scheme`
    - Add `@media (prefers-color-scheme: dark)` block overriding the custom properties with dark-mode values
    - Ensure sufficient contrast ratios in both modes
    - _Requirements: 10.5_

  - [~] 8.3 Implement responsive layout for 360px–1920px viewports
    - Use `@media` breakpoints to stack widgets vertically on narrow viewports (≤768px)
    - Ensure all controls remain accessible and legible at 360px width
    - _Requirements: 10.4_

  - [~] 8.4 Style each widget: Greeting, Focus Timer, To-Do List, Quick Links
    - Style the clock (`#greeting` clock element) at ≥24px, date and greeting at ≥14px
    - Style the timer MM:SS display prominently; style Start/Stop/Reset buttons and completion indicator
    - Style task list rows: checkbox, text (with `.completed` strikethrough), Edit, Delete controls
    - Style quick-links panel: link buttons and Delete controls; inline validation message style
    - _Requirements: 5.2, 2.6, 10.2, 10.3_

- [~] 9. Checkpoint — full integration and final test run
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; all core functionality works without them
- Each task references specific requirements for traceability
- All 18 correctness properties from the design document are covered by property-based tests (P1–P18)
- Property tests use `fast-check` with at least 100 iterations per property (`numRuns: 100`)
- Each property test is tagged with the comment format: `// Feature: todo-life-dashboard, Property N: <title>`
- A `Map`-backed localStorage mock is used in all node/vitest tests to avoid real browser storage I/O
- Run tests with: `npm test` (which executes `vitest --run`)
- The timer uses wall-clock drift correction (`Date.now()` delta) rather than simple decrement to stay within the 100ms tolerance of Req 2.7
- No bundler required: `<script type="module">` provides ES module scoping natively in all target browsers

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "6.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "3.4", "4.2", "4.3", "6.2"] },
    { "id": 3, "tasks": ["4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12", "4.13", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8"] },
    { "id": 4, "tasks": ["7.1", "7.2"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4"] }
  ]
}
```
