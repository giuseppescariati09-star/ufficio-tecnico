# PWA "Ufficio tecnico" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline, iPhone-first study PWA for the Comune di Itri competition.

**Architecture:** Static app with no server. Pure ES modules hold review, exam, storage and content logic; one UI module renders hash routes.

**Tech Stack:** HTML, CSS, JavaScript modules, service worker, Lucide SVG, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-pwa-concorso-itri-design.md`

## Global Constraints

- Scritto pass mark 21/30; default simulation 30 questions in 30 minutes, editable.
- Review intervals 1, 3, 7, 14, 30 days; a wrong answer returns to 1 day.
- Every case has `norma`, `articolo`, `fonte` URL and `verificato` date. Strict validation fails otherwise.
- No third-party scripts, no external requests, no HTML interpretation of content.
- UI follows `.ux-profile.md`: Apple Native, WCAG 2.1 AA, 44px targets, Lucide only, warm Italian copy.
- Layouts pass at 375px and 1280px.

## Page patterns

- Scrivania: Pattern 4, Dashboard / Overview.
- Pratica, Scritto, Orale: Pattern 3, Form (one answer at a time).
- Profilo: Pattern 5, Settings / Configuration.

## Review Focus

- App closed during a simulation: the timer keeps counting and resumes from the saved end time. Test in `exam.test.mjs`.
- Device date moves backwards or a saved progress entry is malformed: the app does not crash. Test in `review.test.mjs` and `storage.test.mjs`.
- Invalid backup file: rejected, existing progress untouched. Test in `storage.test.mjs`.
- Fewer cases than requested questions: the simulation uses all available cases and still scores on 30. Test in `exam.test.mjs`.
- Storage blocked (private mode): the session works and shows a warning. Test in `storage.test.mjs`.

---

### Task 1: Review logic

**Files:** Create `js/review.js`; test `tests/review.test.mjs`.

**Produces:** `INTERVALS`, `grade(state, correct, today) -> state`, `addDays(date, n)`, `todayQueue(cases, progress, today, {newLimit, reviewLimit}) -> case[]`, `mastery(cases, progress) -> 0..100`.

- [ ] Write failing tests: correct on a new case gives box 1 and due +3; correct at box 4 stays at +30; wrong gives box 0 and due +1; queue puts due reviews before new cases and honours limits; mastery is 0 with no progress and 100 with all at box 4; malformed entries count as new.
- [ ] Run `node --test tests/`; expect failure.
- [ ] Implement.
- [ ] Run `node --test tests/`; expect pass.

### Task 2: Exam logic

**Files:** Create `js/exam.js`; test `tests/exam.test.mjs`.

**Produces:** `buildExam(cases, n, minutes, now, rng) -> exam`, `score(exam, cases, passMark) -> {correct, total, onThirty, passed, wrongIds}`, `remainingSeconds(exam, now)`.

- [ ] Write failing tests: balanced selection across offices; fewer cases than `n` uses all; 21 of 30 passes and 20 fails; unanswered counts as wrong; remaining time comes from `endsAt` and never goes below 0.
- [ ] Run, implement, run again.

### Task 3: Storage and content

**Files:** Create `js/storage.js`, `js/content.js`, `scripts/validate-content.mjs`, `content/*.json`; test `tests/storage.test.mjs`, `tests/content.test.mjs`.

**Produces:** `createStore(backend) -> {state, persistent, save(), exportBackup(), importBackup(text), logError(message)}`, `validateCase(c, {strict}) -> string[]`, `validatePack(pack, {strict}) -> string[]`.

- [ ] Write failing tests: blocked backend keeps working with `persistent: false`; corrupt saved data resets safely; invalid backup throws and leaves state unchanged; a case without `fonte` fails; an HTTP source fails; `corretta` outside options fails; strict mode rejects `verificato: null`.
- [ ] Run, implement, run again.
- [ ] Add seed content, each case with `verificato: null` until checked against the official text.

### Task 4: Interface and offline

**Files:** Create `index.html`, `styles.css`, `js/app.js`, `js/icons.js`, `manifest.webmanifest`, `sw.js`, `icons/*`, `tests/e2e.mjs`, `.github/workflows/ci.yml`.

**Consumes:** every interface above.

- [ ] Write the end-to-end test: complete a practice case, see the source link, reload and keep progress; run a simulation; open the oral flow; export a backup; reload offline; no horizontal scroll at 375px and 1280px; no console errors.
- [ ] Run it; expect failure.
- [ ] Implement the screens with Lucide SVG and the service worker.
- [ ] Run it; expect pass. Take screenshots at both widths and inspect them.
- [ ] Run `ux-audit` and fix what it finds.

### Task 5: Verified content

**Files:** Modify `content/*.json`.

- [ ] Use the research notes to set the case mix.
- [ ] Write the remaining cases, up to 120 cases and 20 oral questions.
- [ ] Verify each case against the official text and set its date.
- [ ] Run `node scripts/validate-content.mjs --strict`; expect zero errors.
