# ReDecks

> [!WARNING]
> **This is a personal fork, made only for my own use.**
> ReDecks is a stripped-down and modified copy of the Obsidian plugin [Decks](https://github.com/dscherdi/decks) by Xherdi Lika. I built it for myself and share the source only because the upstream license allows it.
>
> - **It is not maintained.** No support, no bug fixes, no feature requests, no release schedule.
> - **It is not a replacement for Decks.** If you want a working, supported plugin, use the original: [dscherdi/decks](https://github.com/dscherdi/decks).
> - Issues and pull requests are not monitored.

All credit for the engine, the scheduling and the original plugin goes to the upstream author. See [Acknowledgements](#acknowledgements) and [License](#license).

---

## What is ReDecks?

ReDecks turns Obsidian notes into spaced-repetition flashcards, scheduled with FSRS-6. It is based on Decks v2.12.9 with two things changed:

1. The plugin was slimmed down (English only, no AI / Pro features).
2. The card parser was rewritten so that cards are only created inside explicitly marked blocks of a note, using a small set of hashtags.

Card IDs (progress tracking) and the spaced-repetition system are unchanged.

## Changes compared to upstream Decks

### Removed

| Removed | Details |
| --- | --- |
| **All translations except English** | All other locale files are gone. Language initialization, type definitions and the language dropdown in the settings were adjusted, so the plugin is English-only. |
| **All AI features** | AI Generate, AI Refactor and everything that belongs to them: UI components, settings tabs, ribbon/toolbar buttons, context menu entries, commands, services and the related translation keys. |
| **DecksMD Pro** | Authentication, tokens and all Pro-related UI and logic. |
| **BYOK (bring your own key)** | Management of API keys (`ai-keys.json`) and everything around it. |
| **AI-related assets** | Images and GIFs used for the AI features (e.g. `decks_ai_generate.gif`) and references to them. |

Only the plugin's own integration was removed. The `@decks/core` package and `node_modules` were not touched.

### Changed: new block-based card parser

Upstream Decks scans a whole tagged note and turns every matching structure into a card. ReDecks does **not**. A note is scanned only in the regions you mark with start hashtags, and each start hashtag enables only certain card types for the section that follows.

Everything else about cards (stable card IDs, review history, FSRS scheduling) works as before.

## Quick start

1. Build/install the plugin manually (it is not in the Community Plugins list) and enable it.
2. Add `#decks` to a note, open a block with one or more start hashtags, write your cards and close the block with `#enddeck` (see [How the parser works](#how-the-parser-works)).
3. Open the Decks panel (brain icon in the ribbon), click your file and start reviewing.

The filename is used as the deck name. Cards sync when you save the note.

## How the parser works

### 1. Requirements

- A file is scanned **only if it carries the deck tag** (default `#decks`, configurable in the settings).
- Inside such a file, only the regions between a **start hashtag** and `#enddeck` (or the end of the file) are parsed. Nothing else in the note is turned into cards.
- Fenced code blocks (```` ``` ````) are still ignored, and hashtags inside them have no effect.
- Hashtags must stand alone (`#remdeck`, not `x#remdeck`). The line holding them is never turned into a card.
- **Existing notes without start hashtags produce no cards** and their cards disappear on the next sync. Add the hashtags before syncing; cards come back with their review history, since IDs depend on the content.

### 2. Start hashtags

A start hashtag enables card types for the section that follows. Several hashtags on one line combine their types (e.g. `#remdeck #clozedeck`).

| Hashtag | Enables |
| --- | --- |
| `#alldeck` | All five types below |
| `#remdeck` | Single-line term/definition cards |
| `#headerdeck` | Header + paragraph cards |
| `#tabledeck` | Markdown table cards |
| `#clozedeck` | Cloze cards (`==text==`) |
| `#imgdeck` | Image occlusion cards |

### 3. `#enddeck`

`#enddeck` switches all parsers off until the next start hashtag. Anything between `#enddeck` and the next start hashtag is never turned into cards, even if it contains `==`, headings, tables, etc.

### 4. `#remdeck` single-line cards

A line becomes a card if it contains one of these four operators. The operator needs **at least one space before and one space after it**; `Text==Text` is **not** a card.

| Syntax | Result |
| --- | --- |
| `Term == Definition` | Front = Term, Back = Definition |
| `Term >> Definition` | Front = Term, Back = Definition |
| `Definition << Term` | Front = Term, Back = Definition (direction reversed) |
| `Left <> Right` | **Two** cards: Left → Right and Right → Left, each tracked separately |

### 5. `#headerdeck` header + paragraph cards

Each heading is the front of a card, the text below is the back. A card ends at:

- the next heading,
- `#enddeck`,
- **two consecutive blank lines** (counted only once the card has content), or
- the marker `%%endcard%%`.

Everything after the end of a card up to the next card is ignored.

### 6. `#tabledeck` table cards

Two-column markdown tables as before (first column = front, second = back, optional third notes column). A table ends immediately when `%%endcard%%` appears.

### 7. `#clozedeck` and `#imgdeck`

Cloze cards use `==highlight==`: one card per highlight, with the surrounding paragraph (consecutive non-empty lines) as the text. Lines already used as `#remdeck` cards and headings are skipped. The "cloze" setting of the deck profile is ignored for Markdown notes; only `#clozedeck` decides. Image occlusion works as in upstream, but only inside a `#imgdeck` (or `#alldeck`) section.

## Features inherited from upstream

Everything not listed under "Changes" above comes from Decks v2.12.9 and was left as it is. I did not re-test or adapt it for the new parser, so treat it as unverified.

- FSRS-6 scheduling with Standard / Intensive / Trained profiles, per-tag retention targets and daily limits
- Algorithm tuning (client-side FSRS weight optimizer)
- Custom decks built from filter rules, tags and per-card tags
- Statistics (heatmap, retention, forecast, intervals, …)
- Canvas decks, templates, exam decks
- Anki import/export, migration from the Spaced Repetition plugin, automatic backups
- Multi-device sync via `.deckssynclog` files and the SQLite database
- Keyboard shortcuts: **Space** to flip, **1–4** to rate

Some of these (canvas decks, exam decks, title-format and reverse cards, the migrators) were written for the upstream parser and may behave differently or not work at all with the block-based parser. For their documentation, see the [upstream docs](https://decksmd.app/docs/).

## Building

There are no prebuilt releases. Build it yourself, as for any Obsidian plugin:

```bash
npm install
npm run build
```

Then copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/<id>/`, where `<id>` is the `id` in `manifest.json` (currently `decks`).

## Acknowledgements

- **[Decks](https://github.com/dscherdi/decks)** by **Xherdi Lika** (`dscherdi`) – the plugin this fork is based on. If you want the real thing, with updates and support, use it.
- **[`@decks/core`](https://github.com/dscherdi/decks-core)** – the open-source (AGPL-3.0) engine for parsing, FSRS scheduling and sync.
- **[Spaced Repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition)** by st3v3nmw, which pioneered flashcards in Obsidian.

## License

ReDecks is a modified version of Decks and is therefore licensed under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later), like the original.

In short: you are free to use, modify and distribute this software. If you modify it and distribute your changes, or offer it to users over a network, you must make your modified source code available under the same license.

Copyright (C) 2026 Xherdi Lika (original Decks). Modifications for ReDecks by the fork author. See the [LICENSE](./LICENSE) file for the full text.
