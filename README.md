# Tarsi CSE Reviewer

A personal study app for the Philippine Career Service Examination, Professional level (14 March 2027). Unofficial: not affiliated with or endorsed by the Civil Service Commission. Questions are original practice items, not actual exam questions.

It has no backend or accounts. Progress stays in the browser's localStorage, and it works offline after the first load.

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
