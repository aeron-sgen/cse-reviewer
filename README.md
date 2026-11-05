# Tarsi CSE Reviewer

A personal study app for the Philippine Career Service Examination, Professional level (14 March 2027). Unofficial: not affiliated with or endorsed by the Civil Service Commission. Questions are original practice items, not actual exam questions.

It has no backend or accounts. Progress stays in the browser's localStorage, and it works offline after the first load.

**Live app:** https://aeron-sgen.github.io/cse-reviewer/

## What the app does

The same information is in the app's **Guide** tab.

### Learn

- A path of 38 short lessons and 216 questions across 4 units: General Information, Verbal Ability (English and Filipino), Analytical Ability and Numerical Ability.
- Each answer shows an explanation, and General Information answers also name their legal source.
- A missed question comes back later in the same lesson. You finish when every question has been answered correctly.
- No lesson is locked, so you can start anywhere or replay one.

### Hearts

- Each lesson starts with 5 hearts, and every wrong answer costs one, including on retried questions.
- At zero the lesson ends and you can retry right away, with no waiting. That attempt does not complete the lesson or earn XP.
- Your answers still count in your stats, and first-try misses still go to your Mistakes list.
- Practice and mock exams do not use hearts.

### XP, streak and daily goal

- Finishing a lesson or practice set earns 2 XP per question right on the first try, plus 5 XP if all of them were.
- Finishing a mock exam earns 1 XP for every 2 correct answers.
- Earning XP on a day keeps your streak going, and missing a full day restarts it. The daily goal is 30 XP.

### Practice

- **Mistakes:** questions you missed. Each one leaves the list after you get it right in 2 separate sessions.
- **Weakest skill:** drills the skill with your lowest score, once you have answered enough of it.
- **Quick 10:** ten random questions, mixed or from one subject.

### Mock exam

- Full mock: 170 items in 3 h 10 min. Mini mock: 50 items in 56 min.
- There are no answers or hints until you submit. You can go back, mark questions for review and jump around with the question grid.
- Pause stops the clock. When time runs out, the exam submits itself.
- Unanswered questions count as wrong, and missed questions go to your Mistakes list.

### Progress and data

- The Progress tab shows your scores for each skill, past mock results and flagged questions.
- Everything is saved only in that browser on that device, and nothing is sent anywhere. Clearing browser data erases it, so use **Save backup** now and then. **Restore** moves progress to another device.
- "Answer looks wrong?" under an explanation flags a question, with an optional note, on your Progress page.

### Keyboard shortcuts

- `1` to `4`: pick an answer
- `Enter`: check and continue in lessons
- Left and right arrows: move between mock exam questions

## Accuracy

The questions were written and checked with AI, with no human expert review, so mistakes are possible. For anything important, check the cited law. Some laws may also change before the exam.

## Exam facts

Date, scope and the 80.00 passing grade come from [CSC Examination Announcement No. 06, s. 2026](https://csc.gov.ph/phocadownload/userupload/erpo/announcements/2026/ExamAnn_2026_06_Conduct%20of%2014%20March%202027%20CSE-PPT%20orig%20signed.pdf). That announcement does not state the item count, time limit or subject split, so the mock exam length (170 items, 3 h 10 min) follows unofficial reports.

## Editing questions

Questions live in `data/src/<subject>.json`. After a change:

```
node tools/validate.mjs
node tools/build.mjs
```

`questions.js` is the generated file the app loads. Bump `CACHE` in `sw.js` when you ship changes so installed copies refresh.

## Testing

`npm install`, then `node tests/e2e.mjs`. Set `PW_CHROME` to a Chromium path if Playwright's own browser is not installed.

The Nunito font is under the SIL Open Font License (`assets/nunito-LICENSE.txt`).
