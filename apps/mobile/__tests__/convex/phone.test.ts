import { normalizePhone } from "../../../../convex/lib/phone";

describe("normalizePhone()", () => {
  describe("Philippine number formats", () => {
    it("normalizes 09XXXXXXXXX local format to 63 prefix", () => {
      expect(normalizePhone("09172341234")).toBe("639172341234");
    });

    it("normalizes +639XXXXXXXXX international format", () => {
      expect(normalizePhone("+639172341234")).toBe("639172341234");
    });

    it("normalizes bare 9XXXXXXXXX (no leading 0 or country code)", () => {
      expect(normalizePhone("9172341234")).toBe("639172341234");
    });

    it("normalizes spaced format '0917 234 1234'", () => {
      expect(normalizePhone("0917 234 1234")).toBe("639172341234");
    });

    it("normalizes hyphenated format '0917-234-1234'", () => {
      expect(normalizePhone("0917-234-1234")).toBe("639172341234");
    });

    it("normalizes parenthesized format '(0917) 234-1234'", () => {
      expect(normalizePhone("(0917) 234-1234")).toBe("639172341234");
    });

    it("normalizes '+63 917 234 1234' with spaces", () => {
      expect(normalizePhone("+63 917 234 1234")).toBe("639172341234");
    });

    it("normalizes 63XXXXXXXXX (12 digits, already canonical)", () => {
      expect(normalizePhone("639172341234")).toBe("639172341234");
    });

    it("treats all variants of the same number as equal", () => {
      const variants = [
        "0917 234 1234",
        "+63 917 234 1234",
        "+639172341234",
        "639172341234",
        "9172341234",
        "(0917) 234-1234",
      ];
      const normalized = variants.map(normalizePhone);
      const unique = new Set(normalized);
      expect(unique.size).toBe(1);
      expect(unique.has("639172341234")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns null for undefined", () => {
      expect(normalizePhone(undefined)).toBeNull();
    });

    it("returns null for null", () => {
      expect(normalizePhone(null)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(normalizePhone("")).toBeNull();
    });

    it("returns null for string with only non-digit characters", () => {
      expect(normalizePhone("abc")).toBeNull();
      expect(normalizePhone("---")).toBeNull();
      expect(normalizePhone("()")).toBeNull();
    });

    it("returns digit string as-is for non-PH-recognizable formats", () => {
      // 7 digit local USA number — falls through to digits-only fallback
      expect(normalizePhone("555-1234")).toBe("5551234");
      // Foreign 13-digit number — falls through
      expect(normalizePhone("1234567890123")).toBe("1234567890123");
    });

    it("strips letters but preserves digits", () => {
      expect(normalizePhone("0917abc234def1234")).toBe("639172341234");
    });
  });
});
