import { I18n } from "@decks/core";
import { DEFAULT_SETTINGS } from "@/settings";

// English is the only UI language this build offers.
describe("I18n", () => {
  it("defaults to English", () => {
    expect(DEFAULT_SETTINGS.i18n.language).toBe("en");
    I18n.init(DEFAULT_SETTINGS);
    expect(I18n.code).toBe("en");
    expect(I18n.t.deckList.title).toBe("Decks");
  });

  describe("format()", () => {
    it("substitutes single placeholder", () => {
      expect(I18n.format("Hello {name}", { name: "world" })).toBe("Hello world");
    });

    it("substitutes multiple placeholders", () => {
      expect(
        I18n.format("{a} and {b} = {sum}", { a: 1, b: 2, sum: 3 })
      ).toBe("1 and 2 = 3");
    });

    it("leaves unknown placeholders intact", () => {
      expect(I18n.format("Hi {who}", {})).toBe("Hi {who}");
    });

    it("coerces numbers to strings", () => {
      expect(I18n.format("{n}", { n: 42 })).toBe("42");
    });

    it("handles strings with no placeholders", () => {
      expect(I18n.format("plain text", {})).toBe("plain text");
    });
  });
});
