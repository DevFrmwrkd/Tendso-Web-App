"use client";

/**
 * ContentFieldsAuto — collapsible Content-tab form generated from
 * `genericContentSchema`. Renders one group per page section, every
 * editable field, supports lists (add/remove rows), and writes through
 * to the parent draft via dotted-path setters.
 *
 * The component is intentionally stateless about the draft — parent
 * owns it. Calls:
 *   - getValue(path)     → read current value (string for text/textarea,
 *                          [] or array for lists, object for the row payloads).
 *   - setValue(path, v)  → write a value at the dotted path.
 *   - openImagePicker(path) → triggers the SandboxEditor image picker.
 *   - pushLiveText(path, value) → optional live-update to iframe.
 *
 * The Group component handles its own collapsed state. Each input adds
 * `data-field-input="<path>"` so the existing iframe→sidebar focus flow
 * (and the new selection-pulse) still works.
 *
 * Round 1 look (board Review, Content tab): each section is a bordered group
 * that folds open, its fields are kit fields (label above, help below). Only
 * the look changed; every read, write and live push is as it was.
 */

import { useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ImageIcon, Plus, X } from "lucide-react";
import { Button, Icon, cx } from "@/components/r1";
import type { EditorJson } from "./editorProps";
import {
    GENERIC_CONTENT_SCHEMA,
    GROUP_BLOCK,
    type GroupSpec,
    type FieldSpec,
    type ListSpec,
} from "./genericContentSchema";
import { sectionsForTemplate } from "./templateCatalog";
import { TEMPLATE_FIELD_PATHS } from "./templateFieldPaths.generated";
import { rowWriteInList } from "./listRowWrites";

export interface ContentFieldsAutoProps {
    getValue: (path: string) => EditorJson;
    setValue: (path: string, value: EditorJson) => void;
    openImagePicker: (path: string) => void;
    pushLiveText?: (path: string, value: EditorJson) => void;
    /** Comma-joined ids of groups that start expanded. Default: hero + first. */
    expandedInitial?: string[];
    /**
     * The selected template, e.g. "hospitality:BJ". When given, the group list
     * is filtered to the sections that template actually renders, ordered the
     * way the page renders them, and titled with the template's own name for
     * each section. Omit it and the full generic schema shows, unchanged.
     */
    templateCode?: string;
}

/**
 * The groups to show for a template: page order, the template's own names, and
 * nothing for a section it does not render.
 *
 * FAILS OPEN. A group with no GROUP_BLOCK entry ('header'), or an unrecognised
 * template code, keeps the full generic schema — a missing field an owner needs
 * is a worse failure than a spare one they can ignore.
 */
/**
 * The content paths a template actually binds, or null when we cannot tell.
 * null means DO NOT FILTER — an unrecognised template shows the whole schema.
 */
function boundPathsFor(templateCode: string | undefined): Set<string> | null {
    const list = templateCode ? TEMPLATE_FIELD_PATHS[templateCode] : undefined;
    return list && list.length ? new Set(list) : null;
}

/**
 * Does this template draw anything for this field?
 *
 * TWO WAYS TO SURVIVE, and the second matters as much as the first:
 *
 *   1. the template binds the path (or its href companion, or a fallback path)
 *   2. THE FIELD ALREADY HOLDS A VALUE
 *
 * Rule 2 exists because hiding an input does not delete what is behind it. An
 * owner who typed a price under one template, then switched to a template that
 * draws no price, would otherwise have that value stranded in storage with no
 * way to reach or clear it — and it would reappear the moment they switched
 * back. A field with content in it always stays reachable.
 */
function fieldSurvives(
    f: FieldSpec,
    bound: Set<string> | null,
    hasValue: (path: string) => boolean,
): boolean {
    if (!bound) return true;
    if (bound.has(f.path)) return true;
    if (f.hrefPath && bound.has(f.hrefPath)) return true;
    if (f.fallbackPaths?.some((p) => bound.has(p))) return true;
    return hasValue(f.path) || (!!f.hrefPath && hasValue(f.hrefPath));
}

/**
 * A list keeps only the row fields the template draws, and disappears entirely
 * when it draws none of them. Item paths are normalised the way the generator
 * writes them: services.items.N.title covers every row.
 */
function narrowList(
    l: ListSpec,
    bound: Set<string> | null,
    rowHasValue: (listPath: string, key: string) => boolean,
): ListSpec | null {
    if (!bound) return l;
    const compose = (key: string) => (key ? l.path + ".N." + key : l.path + ".N");
    const itemFields = (l.itemFields ?? []).filter(
        (f) => bound.has(compose(f.path)) || rowHasValue(l.path, f.path),
    );
    if (!itemFields.length) return null;
    return itemFields.length === (l.itemFields ?? []).length ? l : { ...l, itemFields };
}

function groupsForTemplate(
    templateCode: string | undefined,
    hasValue: (path: string) => boolean,
    rowHasValue: (listPath: string, key: string) => boolean,
): GroupSpec[] {
    if (!templateCode) return GENERIC_CONTENT_SCHEMA;
    const sections = sectionsForTemplate(templateCode);
    if (!sections.length) return GENERIC_CONTENT_SCHEMA;

    const labelByBlock = new Map(sections.map((s) => [s.block, s.label]));
    const orderByBlock = new Map(sections.map((s, i) => [s.block, i]));
    const bound = boundPathsFor(templateCode);

    const kept = GENERIC_CONTENT_SCHEMA.filter((g) => {
        const block = GROUP_BLOCK[g.id];
        return !block || labelByBlock.has(block);
    });

    const rank = (g: GroupSpec) => {
        const block = GROUP_BLOCK[g.id];
        // Unmapped groups (the header) sit above the page, so they lead.
        if (!block) return -1;
        return orderByBlock.get(block) ?? Number.MAX_SAFE_INTEGER;
    };

    return kept
        .slice()
        .sort((a, b) => rank(a) - rank(b))
        .map((g) => {
            const label = labelByBlock.get(GROUP_BLOCK[g.id] ?? "");
            const titled = label && label !== g.title ? { ...g, title: label } : g;
            if (!bound) return titled;
            const fields = titled.fields
                .map((f) =>
                    f.kind === "list"
                        ? narrowList(f as ListSpec, bound, rowHasValue)
                        : fieldSurvives(f as FieldSpec, bound, hasValue) ? f : null,
                )
                .filter(Boolean) as GroupSpec["fields"];
            return fields.length === titled.fields.length ? titled : { ...titled, fields };
        })
        // A section whose every field this template leaves undrawn has nothing
        // to edit. Dropping it beats an expandable group that opens on nothing.
        .filter((g) => g.fields.length > 0);
}

function isListSpec(x: FieldSpec | ListSpec): x is ListSpec {
    return (x as ListSpec).kind === 'list';
}

function joinPath(...parts: Array<string | number>): string {
    return parts
        .filter((p) => p !== '' && p !== null && p !== undefined)
        .map((p) => String(p))
        .join('.');
}

export default function ContentFieldsAuto({
    getValue,
    setValue,
    openImagePicker,
    pushLiveText,
    expandedInitial,
    templateCode,
}: ContentFieldsAutoProps) {
    // getValue is intentionally NOT a dependency: re-narrowing on every
    // keystroke would make an input vanish the moment its value was cleared.
    // The set is computed for the template, and a field that held a value when
    // the panel opened stays reachable for the whole session.
    const groups = useMemo(
        () => {
            const hasValue = (path: string) => {
                const v = getValue(path);
                return v !== undefined && v !== null && v !== "";
            };
            const rowHasValue = (listPath: string, key: string) => {
                const rows = getValue(listPath);
                if (!Array.isArray(rows)) return false;
                return rows.some((row: EditorJson) => {
                    const v = key ? row?.[key] : row;
                    return v !== undefined && v !== null && v !== "";
                });
            };
            return groupsForTemplate(templateCode, hasValue, rowHasValue);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [templateCode],
    );
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        const defaults = expandedInitial ?? ['header', 'hero'];
        for (const id of defaults) init[id] = true;
        return init;
    });

    const toggle = (id: string) =>
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const handleTextChange = (path: string, value: string) => {
        setValue(path, value);
        pushLiveText?.(path, value);
    };

    return (
        <div className="flex flex-col gap-3">
            {groups.map((group) => (
                <GroupRender
                    key={group.id}
                    group={group}
                    isOpen={!!expanded[group.id]}
                    onToggle={() => toggle(group.id)}
                    getValue={getValue}
                    setValue={setValue}
                    openImagePicker={openImagePicker}
                    onTextChange={handleTextChange}
                    pushLiveText={pushLiveText}
                />
            ))}
        </div>
    );
}

interface GroupRenderProps {
    group: GroupSpec;
    isOpen: boolean;
    onToggle: () => void;
    getValue: (path: string) => EditorJson;
    setValue: (path: string, value: EditorJson) => void;
    openImagePicker: (path: string) => void;
    onTextChange: (path: string, value: string) => void;
    /**
     * Threaded down only for ListField. A row edit cannot go through
     * onTextChange — that writes the LEAF path, which is the bug — so ListField
     * writes the whole array itself and still has to push the live preview
     * update under the leaf path the iframe bridge knows.
     */
    pushLiveText?: (path: string, value: EditorJson) => void;
}

function GroupRender({ group, isOpen, onToggle, getValue, setValue, openImagePicker, onTextChange, pushLiveText }: GroupRenderProps) {
    const bodyId = useId();
    return (
        <div className="rounded-[10px] border border-r1-line px-3.5">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-controls={bodyId}
                className="t-fold-btn h-12"
            >
                <span className="min-w-0 truncate">{group.title}</span>
                <span className="t-fold-chev">
                    <Icon icon={ChevronDown} />
                </span>
            </button>
            {isOpen && (
                <div id={bodyId} className="flex flex-col gap-3.5 pb-4 pt-1">
                    {group.description && <p className="t-help">{group.description}</p>}
                    {group.fields.map((f, i) => (
                        <FieldRender
                            key={`${group.id}-${i}`}
                            field={f}
                            getValue={getValue}
                            setValue={setValue}
                            openImagePicker={openImagePicker}
                            onTextChange={onTextChange}
                            pushLiveText={pushLiveText}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface FieldRenderProps {
    field: FieldSpec | ListSpec;
    getValue: (path: string) => EditorJson;
    setValue: (path: string, value: EditorJson) => void;
    openImagePicker: (path: string) => void;
    onTextChange: (path: string, value: string) => void;
    pushLiveText?: (path: string, value: EditorJson) => void;
}

function FieldRender({ field, getValue, setValue, openImagePicker, onTextChange, pushLiveText }: FieldRenderProps) {
    if (isListSpec(field)) {
        return (
            <ListField
                spec={field}
                getValue={getValue}
                setValue={setValue}
                openImagePicker={openImagePicker}
                onTextChange={onTextChange}
                pushLiveText={pushLiveText}
            />
        );
    }
    return (
        <ScalarField
            spec={field}
            getValue={getValue}
            setValue={setValue}
            openImagePicker={openImagePicker}
            onTextChange={onTextChange}
        />
    );
}

/**
 * Resolve the visible value for a field: prefer the primary path, but if
 * empty, walk fallbackPaths in order. Writes always go to the primary so
 * the admin's edit becomes the source of truth.
 */
function readWithFallbacks(getValue: (p: string) => EditorJson, primary: string, fallbacks?: string[]): EditorJson {
    const primaryVal = getValue(primary);
    if (primaryVal !== undefined && primaryVal !== null && primaryVal !== '') return primaryVal;
    if (fallbacks) {
        for (const fb of fallbacks) {
            const v = getValue(fb);
            if (v !== undefined && v !== null && v !== '') return v;
        }
    }
    return primaryVal;
}

function ScalarField({ spec, getValue, openImagePicker, onTextChange }: { spec: FieldSpec } & Omit<FieldRenderProps, 'field'>) {
    const id = useId();
    const helpId = `${id}-help`;
    const value = readWithFallbacks(getValue, spec.path, spec.fallbackPaths);
    const stringValue = value == null ? '' : String(value);
    const help = spec.hint ? <p className="t-help" id={helpId}>{spec.hint}</p> : null;
    const describedBy = spec.hint ? helpId : undefined;

    if (spec.kind === 'image') {
        return (
            <div className="t-field">
                <label className="t-field-label" htmlFor={id}>{spec.label}</label>
                <button
                    id={id}
                    type="button"
                    onClick={() => openImagePicker(spec.path)}
                    aria-describedby={describedBy}
                    className="t-input flex cursor-pointer items-center justify-between gap-2.5 text-left"
                    data-field-input={spec.path}
                >
                    <span className={cx("min-w-0 flex-1 truncate font-r1-mono text-xs", !stringValue && "text-r1-ink-3")}>
                        {stringValue || "Choose an image"}
                    </span>
                    <span className="flex flex-none text-r1-ink-3">
                        <Icon icon={ImageIcon} />
                    </span>
                </button>
                {help}
            </div>
        );
    }

    if (spec.kind === 'link') {
        const hrefPath = spec.hrefPath || `${spec.path}.href`;
        const hrefValue = readWithFallbacks(getValue, hrefPath, spec.hrefFallbackPaths);
        const hrefString = hrefValue == null ? '' : String(hrefValue);
        return (
            <div className="t-field">
                <label className="t-field-label" htmlFor={id}>{spec.label}</label>
                <input
                    id={id}
                    type="text"
                    value={stringValue}
                    onChange={(e) => onTextChange(spec.path, e.target.value)}
                    placeholder={spec.placeholder || 'Button text'}
                    aria-describedby={describedBy}
                    className="t-input"
                    data-field-input={spec.path}
                />
                <input
                    type="text"
                    value={hrefString}
                    onChange={(e) => onTextChange(hrefPath, e.target.value)}
                    placeholder="https://… or #anchor"
                    aria-label={`${spec.label}: where it goes`}
                    className="t-input font-r1-mono"
                    data-field-input={hrefPath}
                />
                {help}
            </div>
        );
    }

    if (spec.kind === 'textarea') {
        return (
            <div className="t-field">
                <label className="t-field-label" htmlFor={id}>{spec.label}</label>
                <textarea
                    id={id}
                    value={stringValue}
                    onChange={(e) => onTextChange(spec.path, e.target.value)}
                    placeholder={spec.placeholder}
                    aria-describedby={describedBy}
                    rows={4}
                    className="t-input"
                    data-field-input={spec.path}
                />
                {help}
            </div>
        );
    }

    return (
        <div className="t-field">
            <label className="t-field-label" htmlFor={id}>{spec.label}</label>
            <input
                id={id}
                type="text"
                value={stringValue}
                onChange={(e) => onTextChange(spec.path, e.target.value)}
                placeholder={spec.placeholder}
                aria-describedby={describedBy}
                className="t-input"
                data-field-input={spec.path}
            />
            {help}
        </div>
    );
}

function ListField({ spec, getValue, setValue, openImagePicker, onTextChange, pushLiveText }: { spec: ListSpec } & Omit<FieldRenderProps, 'field'>) {
    let raw = getValue(spec.path);
    if ((!Array.isArray(raw) || raw.length === 0) && spec.fallbackPaths) {
        for (const fb of spec.fallbackPaths) {
            const v = getValue(fb);
            if (Array.isArray(v) && v.length > 0) {
                raw = v;
                break;
            }
        }
    }
    const list: EditorJson[] = Array.isArray(raw) ? raw : [];

    const handleAdd = () => {
        const newItem = spec.newItem !== undefined ? spec.newItem : '';
        const cloned = JSON.parse(JSON.stringify(newItem));
        setValue(spec.path, [...list, cloned]);
    };
    const handleRemove = (idx: number) => {
        setValue(spec.path, list.filter((_, i) => i !== idx));
    };
    const handleMove = (from: number, dir: -1 | 1) => {
        const to = from + dir;
        if (to < 0 || to >= list.length) return;
        const next = list.slice();
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        setValue(spec.path, next);
    };

    // ── Row writes carry the whole list ───────────────────────────────────
    // `list` above may have come from spec.fallbackPaths, or from the derived
    // defaults the caller's getValue chains onto — in which case spec.path holds
    // NOTHING. A per-row input that wrote its own leaf (gallery.items.3.caption)
    // therefore created a fresh SPARSE array with one partial row, and
    // JSON.stringify turned the holes into null: three tiles destroyed by
    // editing the fourth, with an honest success toast on top.
    //
    // So a row write rebuilds `list` — exactly what the admin is looking at,
    // whatever it was read from — with that one leaf changed, and writes it to
    // spec.path in a SINGLE setValue call. Add / Remove / Reorder above have
    // always done this; these are the writers that did not.
    //
    // One call, not read-then-write: two sequential writes would race each other
    // on stale draft state.
    //
    // Nothing here fires on render or on mount. A submission that is merely
    // OPENED still persists nothing, so the derived defaults stay derived
    // (lib/derive-content-defaults.ts keeps re-deriving them) and an untouched
    // draft stays clean.
    const writeRow = (path: string, value: EditorJson): boolean => {
        // null for a path outside this list, a non-numeric segment where the
        // index belongs, or an index past the rows on screen — all of which
        // fall through to the plain setValue rather than being guessed at.
        const write = rowWriteInList(spec.path, list, path, value);
        if (!write) return false;
        setValue(write.path, write.value);
        return true;
    };
    const rowSetValue = (path: string, value: EditorJson) => {
        if (!writeRow(path, value)) setValue(path, value);
    };
    // The live preview still has to be told about the LEAF, not the array: the
    // iframe bridge matches on the data-field path the row's input carries.
    const rowTextChange = (path: string, value: string) => {
        if (writeRow(path, value)) pushLiveText?.(path, value);
        else onTextChange(path, value);
    };

    // Determine whether items are strings (when itemFields has a single
    // field with path '') vs objects (any other shape).
    const isStringList = spec.itemFields.length === 1 && spec.itemFields[0].path === '';
    const canAdd = !spec.fixed && (spec.maxItems === undefined || list.length < spec.maxItems);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <span className="t-field-label">
                    {spec.label} <span className="t-count">{list.length}</span>
                </span>
                {canAdd && (
                    <Button size="sm" onClick={handleAdd}>
                        <Icon icon={Plus} />
                        Add
                    </Button>
                )}
            </div>
            {list.length === 0 && <p className="t-meta">No items yet.</p>}
            {list.map((_item, idx) => {
                const itemPath = joinPath(spec.path, idx);
                const rowName = `${spec.label} row ${idx + 1}`;
                return (
                    <div key={idx} className="flex flex-col gap-3 rounded-r1 border border-r1-line p-2.5">
                        <div className="flex items-center justify-between gap-2 border-b border-r1-line-3 pb-1.5">
                            <span className="t-label t-num">#{idx + 1}</span>
                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon
                                    onClick={() => handleMove(idx, -1)}
                                    disabled={idx === 0}
                                    title="Move up"
                                    aria-label={`Move ${rowName} up`}
                                >
                                    <Icon icon={ArrowUp} size={14} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon
                                    onClick={() => handleMove(idx, 1)}
                                    disabled={idx === list.length - 1}
                                    title="Move down"
                                    aria-label={`Move ${rowName} down`}
                                >
                                    <Icon icon={ArrowDown} size={14} />
                                </Button>
                                {!spec.fixed && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon
                                        onClick={() => handleRemove(idx)}
                                        title="Remove"
                                        aria-label={`Remove ${rowName}`}
                                        className="text-r1-red"
                                    >
                                        <Icon icon={X} size={14} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {isStringList ? (
                            // Render the single field at the item path itself —
                            // the row IS the value, so writeRow's subPath is ''.
                            <ScalarField
                                spec={{ ...spec.itemFields[0], path: itemPath }}
                                getValue={getValue}
                                setValue={rowSetValue}
                                openImagePicker={openImagePicker}
                                onTextChange={rowTextChange}
                            />
                        ) : (
                            spec.itemFields.map((sub, sidx) => {
                                const subPath = joinPath(itemPath, sub.path);
                                // hrefPath is re-based into the row too. Item
                                // paths are relative ('cta.text'), so a link
                                // itemField that kept an absolute hrefPath would
                                // write the row's text at services.items.0.cta.text
                                // and its href at the TOP LEVEL — every row
                                // fighting over one shared key. No list declares
                                // a link field today; this is what makes it safe
                                // for one to.
                                const rowSpec = sub.hrefPath
                                    ? { ...sub, path: subPath, hrefPath: joinPath(itemPath, sub.hrefPath) }
                                    : { ...sub, path: subPath };
                                return (
                                    <ScalarField
                                        key={sidx}
                                        spec={rowSpec}
                                        getValue={getValue}
                                        setValue={rowSetValue}
                                        openImagePicker={openImagePicker}
                                        onTextChange={rowTextChange}
                                    />
                                );
                            })
                        )}
                    </div>
                );
            })}
        </div>
    );
}
