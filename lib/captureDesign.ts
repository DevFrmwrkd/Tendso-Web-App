import { templateByCode, type TemplateDef } from '../components/editor/templateCatalog';

/** Resolve every canonical design, including saved choices outside mobile's curated list. */
export function captureDesignByCode(value: unknown): TemplateDef | undefined {
    return typeof value === 'string' ? templateByCode(value.trim()) : undefined;
}

/** Do not upgrade bare letters or guess a design at the capture API boundary. */
export function validCaptureDesignCode(value: unknown): string | null {
    return captureDesignByCode(value)?.code ?? null;
}
