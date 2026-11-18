import {
  FlashcardParser,
  scanClozeDeletions,
  type ParsedFlashcard,
} from "@decks/core";

/** Card types a block hashtag can switch on. */
export type DeckBlockType =
  | "remdeck"
  | "headerdeck"
  | "tabledeck"
  | "clozedeck"
  | "imgdeck";

type BlockTag = DeckBlockType | "alldeck" | "enddeck";

const ALL_BLOCK_TYPES: DeckBlockType[] = [
  "remdeck",
  "headerdeck",
  "tabledeck",
  "clozedeck",
  "imgdeck",
];

const BLOCK_TAG_SOURCE =
  "(?:^|\\s)#(alldeck|remdeck|headerdeck|tabledeck|clozedeck|imgdeck|enddeck)(?=\\s|$)";
const CODE_FENCE_REGEX = /^(`{3,}|~{3,})/;
const HEADER_REGEX = /^(#{1,6})\s+/;
const TABLE_ROW_REGEX = /^\|.*\|$/;
const END_CARD_MARKER = "%%endcard%%";
// One line, one operator with at least one whitespace on each side.
// `Text==Text` is no card; the leftmost spaced operator wins.
const REM_LINE_REGEX = /^(.*?\S)\s+(==|>>|<<|<>)\s+(\S.*)$/;

interface LineInfo {
  /** Card types active on this line (empty outside any block). */
  types: Set<DeckBlockType>;
  /** The line carries a block hashtag (start tag or #enddeck). */
  control: boolean;
  /** Code fence line or a line inside a fenced code block. */
  code: boolean;
  frontmatter: boolean;
}

interface PlacedCard {
  card: ParsedFlashcard;
  line: number;
}

interface SectionStops {
  /** End the card at two consecutive empty lines. */
  blankLines: boolean;
  /** End the card at `%%endcard%%`. */
  endCard: boolean;
}

interface HeaderTrail {
  breadcrumb: string;
  tags: string[];
}

/**
 * Block-controlled markdown parser.
 *
 * Only regions between a start hashtag (#alldeck, #remdeck, #headerdeck,
 * #tabledeck, #clozedeck, #imgdeck) and #enddeck (or end of file) are parsed,
 * and only for the card types the start hashtags switch on. Header, table and
 * image-occlusion cards are still produced by the core FlashcardParser (on a
 * masked copy of the note with the same line count), so card ids and anchors
 * behave exactly as before. Card ids themselves are derived later by the
 * FlashcardSynchronizer from the parsed card content.
 */
export class DeckBlockParser {
  static parse(
    content: string,
    headerLevels: number[],
    fileTitle: string | undefined,
    examEnabled: boolean
  ): ParsedFlashcard[] {
    const lines = content.split("\n");
    const info = DeckBlockParser.scanBlocks(lines);
    const used = (type: DeckBlockType): boolean =>
      info.some((l) => DeckBlockParser.isActive(l, type));

    const placed: PlacedCard[] = [];

    if (used("headerdeck")) {
      placed.push(
        ...DeckBlockParser.parseWithCore(
          lines,
          info,
          "headerdeck",
          { blankLines: true, endCard: true },
          ["header-paragraph", "multiple-choice"],
          headerLevels,
          fileTitle,
          examEnabled
        )
      );
    }
    if (used("tabledeck")) {
      placed.push(
        ...DeckBlockParser.parseWithCore(
          lines,
          info,
          "tabledeck",
          { blankLines: false, endCard: true },
          ["table"],
          headerLevels,
          fileTitle,
          examEnabled
        )
      );
    }
    if (used("imgdeck")) {
      placed.push(
        ...DeckBlockParser.parseWithCore(
          lines,
          info,
          "imgdeck",
          { blankLines: false, endCard: false },
          ["image-occlusion", "image-occlusion-v2"],
          headerLevels,
          fileTitle,
          examEnabled
        )
      );
    }

    const trail = DeckBlockParser.headerTrail(lines, info);
    const remLines = new Set<number>();
    if (used("remdeck")) {
      placed.push(...DeckBlockParser.parseRemLines(lines, info, trail, remLines));
    }
    if (used("clozedeck")) {
      placed.push(...DeckBlockParser.parseClozes(lines, info, trail, remLines));
    }

    // Note order: by the line each card starts on, then in creation order.
    return placed
      .map((p, index) => ({ ...p, index }))
      .sort((a, b) => a.line - b.line || a.index - b.index)
      .map((p) => p.card);
  }

  private static isActive(l: LineInfo, type: DeckBlockType): boolean {
    return !l.control && !l.frontmatter && l.types.has(type);
  }

  private static blockTags(line: string): BlockTag[] {
    const tags: BlockTag[] = [];
    const regex = new RegExp(BLOCK_TAG_SOURCE, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      tags.push(match[1].toLowerCase() as BlockTag);
    }
    return tags;
  }

  /** Which card types are active on each line. Tags inside code blocks are ignored. */
  private static scanBlocks(lines: string[]): LineInfo[] {
    const info: LineInfo[] = [];
    const none = new Set<DeckBlockType>();
    let active = none;
    let inFrontmatter = false;
    let inCode = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (i === 0 && trimmed === "---") {
        inFrontmatter = true;
        info.push({ types: none, control: false, code: false, frontmatter: true });
        continue;
      }
      if (inFrontmatter) {
        if (trimmed === "---") inFrontmatter = false;
        info.push({ types: none, control: false, code: false, frontmatter: true });
        continue;
      }

      if (CODE_FENCE_REGEX.test(trimmed)) {
        inCode = !inCode;
        info.push({ types: active, control: false, code: true, frontmatter: false });
        continue;
      }
      if (inCode) {
        info.push({ types: active, control: false, code: true, frontmatter: false });
        continue;
      }

      const tags = DeckBlockParser.blockTags(lines[i]);
      if (tags.length > 0) {
        const next = new Set<DeckBlockType>();
        for (const tag of tags) {
          if (tag === "enddeck") {
            next.clear();
          } else if (tag === "alldeck") {
            for (const type of ALL_BLOCK_TYPES) next.add(type);
          } else {
            next.add(tag);
          }
        }
        active = next.size > 0 ? next : none;
        info.push({ types: none, control: true, code: false, frontmatter: false });
        continue;
      }

      info.push({ types: active, control: false, code: false, frontmatter: false });
    }
    return info;
  }

  /** Copy of the note (same line count) with every line outside `type`'s blocks blanked. */
  private static mask(lines: string[], info: LineInfo[], type: DeckBlockType): string[] {
    return lines.map((line, i) =>
      info[i].frontmatter || DeckBlockParser.isActive(info[i], type) ? line : ""
    );
  }

  /**
   * End header sections early: at a block boundary (#enddeck, next start tag,
   * region of another type) and, depending on `stops`, at two consecutive empty
   * lines or at `%%endcard%%`. Everything from there to the next header is blanked.
   */
  private static applySectionStops(
    masked: string[],
    info: LineInfo[],
    type: DeckBlockType,
    stops: SectionStops
  ): string[] {
    const out = masked.slice();
    let inSection = false;
    let cutting = false;
    let sawContent = false;
    let blankRun = 0;
    let inCode = false;

    for (let i = 0; i < out.length; i++) {
      if (info[i].frontmatter) continue;
      const line = out[i];
      const trimmed = line.trim();
      const active = DeckBlockParser.isActive(info[i], type);
      const fence = active && CODE_FENCE_REGEX.test(trimmed);
      const header = active && !inCode && !fence && HEADER_REGEX.test(line);
      if (fence) inCode = !inCode;

      if (header) {
        inSection = true;
        cutting = false;
        sawContent = false;
        blankRun = 0;
        continue;
      }
      if (!inSection) continue;
      if (!active) {
        // Block boundary: the current card ends here.
        cutting = true;
        continue;
      }
      if (cutting) {
        out[i] = "";
        continue;
      }
      if (inCode || fence) {
        sawContent = true;
        blankRun = 0;
        continue;
      }
      if (stops.endCard) {
        const at = line.indexOf(END_CARD_MARKER);
        if (at !== -1) {
          out[i] = line.slice(0, at);
          cutting = true;
          continue;
        }
      }
      if (stops.blankLines) {
        if (trimmed === "") {
          if (sawContent) {
            blankRun++;
            if (blankRun >= 2) cutting = true;
          }
        } else {
          sawContent = true;
          blankRun = 0;
        }
      }
    }
    return out;
  }

  /** Run the core parser on `type`'s masked note and keep only the given card types. */
  private static parseWithCore(
    lines: string[],
    info: LineInfo[],
    type: DeckBlockType,
    stops: SectionStops,
    keep: ReadonlyArray<ParsedFlashcard["type"]>,
    headerLevels: number[],
    fileTitle: string | undefined,
    examEnabled: boolean
  ): PlacedCard[] {
    const masked = DeckBlockParser.applySectionStops(
      DeckBlockParser.mask(lines, info, type),
      info,
      type,
      stops
    );
    const result = FlashcardParser.parseWithLines(
      masked.join("\n"),
      headerLevels,
      fileTitle,
      false,
      examEnabled
    );
    const placed: PlacedCard[] = [];
    result.cards.forEach((card, index) => {
      if (keep.indexOf(card.type) !== -1) {
        placed.push({ card, line: result.lines[index] ?? 0 });
      }
    });
    return placed;
  }

  /** Breadcrumb and inherited header tags for every line. */
  private static headerTrail(lines: string[], info: LineInfo[]): HeaderTrail[] {
    const stack: Array<{ text: string; level: number; tags: string[] }> = [];
    const out: HeaderTrail[] = [];
    let current: HeaderTrail = { breadcrumb: "", tags: [] };

    for (let i = 0; i < lines.length; i++) {
      const l = info[i];
      const match = !l.frontmatter && !l.code && !l.control
        ? HEADER_REGEX.exec(lines[i])
        : null;
      if (match) {
        const level = match[1].length;
        const { cleaned, tags } = FlashcardParser.extractAndStripTags(
          lines[i].replace(/^#{1,6}\s+/, "")
        );
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        stack.push({ text: cleaned, level, tags });
        const allTags: string[] = [];
        for (const h of stack) allTags.push(...h.tags);
        current = {
          breadcrumb: stack.map((h) => h.text).join(" > "),
          tags: Array.from(new Set(allTags)),
        };
      }
      out.push(current);
    }
    return out;
  }

  /** #remdeck: one-line cards with `==`, `>>`, `<<` and `<>`. */
  private static parseRemLines(
    lines: string[],
    info: LineInfo[],
    trail: HeaderTrail[],
    remLines: Set<number>
  ): PlacedCard[] {
    const placed: PlacedCard[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (!DeckBlockParser.isActive(info[i], "remdeck") || info[i].code) continue;
      const line = lines[i];
      const trimmed = line.trim();
      if (HEADER_REGEX.test(line) || TABLE_ROW_REGEX.test(trimmed)) continue;

      const match = REM_LINE_REGEX.exec(trimmed);
      if (!match) continue;
      const left = match[1].trim();
      const operator = match[2];
      const right = match[3].trim();
      const { breadcrumb, tags } = trail[i];
      const card = (front: string, back: string): PlacedCard => ({
        card: {
          front,
          back,
          notes: "",
          type: "table",
          breadcrumb,
          tags: [...tags],
        },
        line: i,
      });

      switch (operator) {
        case "==":
        case ">>":
          placed.push(card(left, right));
          break;
        case "<<":
          // `Definition << Begriff`: the term is the front.
          placed.push(card(right, left));
          break;
        case "<>":
          placed.push(card(left, right), card(right, left));
          break;
      }
      remLines.add(i);
    }
    return placed;
  }

  /**
   * #clozedeck: every `==x==` in a paragraph (consecutive non-empty lines)
   * becomes a front-only cloze card with the paragraph as its text.
   */
  private static parseClozes(
    lines: string[],
    info: LineInfo[],
    trail: HeaderTrail[],
    remLines: Set<number>
  ): PlacedCard[] {
    const placed: PlacedCard[] = [];
    let start = -1;
    let paragraph: string[] = [];

    const flush = (): void => {
      if (paragraph.length > 0) {
        const text = paragraph.join("\n");
        const { breadcrumb, tags } = trail[start];
        for (const deletion of scanClozeDeletions(text)) {
          placed.push({
            card: {
              front: text,
              back: "",
              notes: "",
              type: "cloze",
              breadcrumb,
              tags: [...tags],
              clozeText: deletion.text,
              clozeOrder: deletion.order,
              clozeLineIndex: deletion.indexInLine,
            },
            line: start + deletion.lineIndex,
          });
        }
      }
      paragraph = [];
      start = -1;
    };

    for (let i = 0; i < lines.length; i++) {
      const l = info[i];
      const line = lines[i];
      const inParagraph =
        DeckBlockParser.isActive(l, "clozedeck") &&
        !l.code &&
        !remLines.has(i) &&
        line.trim() !== "" &&
        !HEADER_REGEX.test(line);
      if (!inParagraph) {
        flush();
        continue;
      }
      if (start === -1) start = i;
      paragraph.push(line);
    }
    flush();
    return placed;
  }
}
