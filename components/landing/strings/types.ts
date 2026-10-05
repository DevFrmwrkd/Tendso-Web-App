/** A string table: key → text. */
export type Dict = Record<string, string>;

/**
 * One surface's strings, in both languages. Every key goes in BOTH tables;
 * a missing Tagalog value falls back to English rather than showing a blank.
 */
export type Strings = { en: Dict; tl: Dict };
