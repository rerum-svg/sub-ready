# Sub-Ready

A free, static web tool for teachers: paste rough sub-plan notes, answer 5–8 targeted questions, and print a minute-by-minute substitute script.

- **No backend, no build step, no accounts, no analytics.** Plain HTML/CSS/vanilla JS.
- **The AI only reorganizes the teacher's own words.** Plain code handles times, layout, validation and checks. Anything the teacher didn't provide prints as *"Not provided — ask the office."* Any line that uses words not found in the teacher's notes is marked **Check**.
- **Privacy:** student names are swapped for `[STUDENT_n]` tokens on the device before any AI step, and restored only in the final output. Nothing is uploaded.

## How the AI step runs

1. **On-device (Chrome built-in Prompt API / Gemini Nano).** The app feature-detects `'LanguageModel' in self`, then calls `LanguageModel.availability({expectedInputs:[{type:'text',languages:['en']}], expectedOutputs:[{type:'text',languages:['en']}]})`. The result is one of `available`, `downloadable`, `downloading` or `unavailable`. The session is created with `LanguageModel.create(...)` (with a download `monitor`) from a button click, and `session.prompt(text, { responseConstraint: jsonSchema })` returns the JSON.
   - Requirements (Chrome docs, checked Nov 2026): desktop Chrome 148+ on Windows/macOS/Linux/Chromebook Plus, 22 GB free disk, and a GPU with >4 GB VRAM or 16 GB RAM with 4+ cores. It does not run on Android, iOS or regular Chromebooks.
2. **Copy-paste (any device).** The app shows a ready-made prompt with names already hidden. The teacher pastes it into any chatbot, then pastes the reply back. The parser tolerates prose around the reply, unterminated code fences, trailing commas, smart quotes, unquoted keys, single quotes, comments and truncated replies.
3. **No AI.** Built-in checklist questions plus a basic script built from the teacher's own lines.

## Files

```
index.html        landing + tool (one page)
styles.css        warm, mobile-readable design + print stylesheet
js/config.js      PRO_URL = '' (empty -> "Pro coming soon, join the list", no link)
js/core.js        pure logic: masking, lint, prompts, JSON repair, time math, grounding, render
js/app.js         UI wiring
tests/            node unit/pipeline tests + Playwright browser E2E/screenshots
screens/          screenshots
```

## Tests

```bash
node tests/run-tests.js              # pipeline + edge cases -> tests/RESULTS.md, tests/out/*.html
python3 tests/e2e_screens.py         # browser E2E on a local server -> screens/*.png
python3 tests/e2e_screens.py https://<live-url>/ live-   # same checks against a deployed URL
```

## Deploy (free)

### GitHub Pages

```bash
gh repo create <owner>/sub-ready --public --source=. --remote=origin --push \
  --description "Free tool: turn rough notes into a sub plan a stranger can follow. Runs in your browser."
gh api -X POST repos/<owner>/sub-ready/pages -f "source[branch]=main" -f "source[path]=/"
gh api repos/<owner>/sub-ready/pages --jq .html_url   # -> https://<owner>.github.io/sub-ready/
```

The `.nojekyll` file makes Pages serve files as-is. Note that the owner name becomes part of the URL (`<owner>.github.io`).

### Cloudflare Pages

Dashboard: Workers & Pages → Create → Pages → connect the GitHub repo. Build command: *(none)*. Output directory: `/`.
Or with the CLI: `npx wrangler pages deploy . --project-name sub-ready`. You get `https://sub-ready.pages.dev`, a URL with no owner name in it.

## Turning on Pro later

Set `PRO_URL` in `js/config.js` to a checkout link. The button then reads "Get Pro ($9 one-time)". Pro features (saved binder, multiple periods, extra templates) are not built yet.
