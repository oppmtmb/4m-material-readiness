# 4M Material Readiness — Shortage Comparator

A browser-based tool that cross-checks **Excel shortage lists** against **email shortage reports** to classify each part number's material readiness status by Part Number (PN) and MMO/Work Order.

🔗 Live app: [https://ai.studio/apps/c5e55dfa-8d71-4e4d-b158-5ba76839048d](https://oppmtmb.github.io/4m-material-readiness/)

## What it does

1. **Upload Excel shortage file(s)** (.xlsx/.xls/.csv) — one or more MMO/WO shortage sheets with PN, Short Qty, MMO, and (optionally) Part Name columns.
2. **Upload/paste email shortage report(s)** (.msg, .eml, .txt, .html, or pasted text) — the tool extracts the PNs and MMOs mentioned.
3. The matching engine compares the two sources per PN/MMO and classifies each line into:
   - 🔴 **1st / Need to Check** — PN is in the email, in the Excel file, and has Short Qty > 0
   - 🟡 **2nd** — PN is in the email but not found in the Excel shortage list
   - 🟢 **Good / NR (Not reported)** — everything else (resolved, or MMO not mentioned in the email)
4. Review results in a sortable, color-coded table with summary stats (Total / Not reported / 1st / 2nd / Good).
5. Export the results as **CSV** or a formatted multi-page **PDF report**.

Additional features:
- Matches MMO automatically from the Excel filename when it's not explicitly in a column.
- Case-sensitive matching toggle.
- Bilingual UI (Thai / English) via a language switcher.
- Built-in sample dataset to try the tool without uploading files.



## Getting started

**Prerequisites:** Node.js

```bash
# install dependencies
npm install

# start the dev server (http://localhost:3000)
npm run dev

# type-check
npm run lint

# production build
npm run build
```



## Project structure

```
src/
  App.tsx                  # Matching engine + page layout, state for Excel files & email data
  LanguageContext.tsx      # Thai/English i18n context
  types.ts                 # ExcelRow, EmailData, ComparedResult, MatchStatus, Stats
  components/
    ExcelInput.tsx         # Excel/CSV upload, column mapping
    EmailInput.tsx         # Email (.msg/.eml/.txt/.html) upload & PN/MMO extraction
    ResultsDisplay.tsx     # Results table, stats, CSV export, PDF export
    SampleData.ts          # Built-in sample dataset
```

## Match logic summary

| Status | Condition |
|---|---|
| 🔴 1st (Need to Check) | PN found in both email and Excel, with Short Qty > 0 |
| 🟡 2nd | PN found in email but not in the Excel shortage list |
| 🟢 Good / Not reported | All other cases |
