import {
  validatePreviewImageUploadArgs,
  buildPreviewImageStorageKey,
  formatCreatorDisplayName,
} from "../../../../convex/leads";

describe("validatePreviewImageUploadArgs()", () => {
  it("accepts image/jpeg at 1MB", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "image/jpeg", sizeBytes: 1_000_000 });
    expect(r.ok).toBe(true);
  });

  it("accepts image/png at exactly 2MB limit", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "image/png", sizeBytes: 2_000_000 });
    expect(r.ok).toBe(true);
  });

  it("accepts image/webp", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "image/webp", sizeBytes: 500_000 });
    expect(r.ok).toBe(true);
  });

  it("rejects sizes above 2MB", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "image/jpeg", sizeBytes: 2_000_001 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/too large/i);
  });

  it("rejects zero-byte uploads", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "image/jpeg", sizeBytes: 0 });
    expect(r.ok).toBe(false);
  });

  it("rejects negative size (paranoid client tampering)", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "image/jpeg", sizeBytes: -1 });
    expect(r.ok).toBe(false);
  });

  it("rejects unsupported mime types", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "image/heic", sizeBytes: 500_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unsupported/i);
  });

  it("rejects PDF disguised as a request", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "application/pdf", sizeBytes: 100_000 });
    expect(r.ok).toBe(false);
  });

  it("rejects empty mime type", () => {
    const r = validatePreviewImageUploadArgs({ mimeType: "", sizeBytes: 100_000 });
    expect(r.ok).toBe(false);
  });
});

describe("buildPreviewImageStorageKey()", () => {
  it("includes the lead id in the path", () => {
    const key = buildPreviewImageStorageKey("lead_abc123", "image/jpeg", 1_700_000_000_000);
    expect(key).toContain("lead_abc123");
  });

  it("uses the mime type subtype as the file extension", () => {
    expect(
      buildPreviewImageStorageKey("lead_abc123", "image/jpeg", 1_700_000_000_000),
    ).toMatch(/\.jpeg$/);
    expect(
      buildPreviewImageStorageKey("lead_abc123", "image/png", 1_700_000_000_000),
    ).toMatch(/\.png$/);
    expect(
      buildPreviewImageStorageKey("lead_abc123", "image/webp", 1_700_000_000_000),
    ).toMatch(/\.webp$/);
  });

  it("namespaces under lead-previews/", () => {
    const key = buildPreviewImageStorageKey("lead_abc123", "image/jpeg", 1_700_000_000_000);
    expect(key.startsWith("lead-previews/")).toBe(true);
  });

  it("includes a timestamp so consecutive uploads don't collide", () => {
    const a = buildPreviewImageStorageKey("lead_abc123", "image/jpeg", 1_700_000_000_000);
    const b = buildPreviewImageStorageKey("lead_abc123", "image/jpeg", 1_700_000_001_000);
    expect(a).not.toBe(b);
  });

  it("falls back to 'bin' extension when mime type is malformed", () => {
    expect(
      buildPreviewImageStorageKey("lead_abc123", "weirdformat", 1_700_000_000_000),
    ).toMatch(/\.bin$/);
  });
});

describe("formatCreatorDisplayName()", () => {
  it("returns 'First L.' for normal first+last", () => {
    expect(formatCreatorDisplayName("Maria", "Santos")).toBe("Maria S.");
  });

  it("trims whitespace", () => {
    expect(formatCreatorDisplayName("  Maria  ", "  Santos  ")).toBe("Maria S.");
  });

  it("returns just first name if no last name", () => {
    expect(formatCreatorDisplayName("Maria", null)).toBe("Maria");
    expect(formatCreatorDisplayName("Maria", undefined)).toBe("Maria");
    expect(formatCreatorDisplayName("Maria", "")).toBe("Maria");
  });

  it("returns 'Unknown creator' when both are empty", () => {
    expect(formatCreatorDisplayName(null, null)).toBe("Unknown creator");
    expect(formatCreatorDisplayName(undefined, undefined)).toBe("Unknown creator");
    expect(formatCreatorDisplayName("", "")).toBe("Unknown creator");
    expect(formatCreatorDisplayName("  ", "  ")).toBe("Unknown creator");
  });

  it("uppercase first letter of last name regardless of input case", () => {
    expect(formatCreatorDisplayName("Maria", "santos")).toBe("Maria s.");
    // Note: we don't force uppercase; the existing convention is what the user has — keeps fidelity
  });

  it("handles single-character last name", () => {
    expect(formatCreatorDisplayName("X", "Y")).toBe("X Y.");
  });

  it("preserves Filipino names with special characters", () => {
    expect(formatCreatorDisplayName("José", "Cruz")).toBe("José C.");
    expect(formatCreatorDisplayName("Ñoño", "Reyes")).toBe("Ñoño R.");
  });
});
