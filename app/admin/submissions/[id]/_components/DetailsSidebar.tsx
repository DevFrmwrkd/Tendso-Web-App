"use client";

import { useState, ReactNode } from "react";
import Image from "next/image";
import { Copy, Pencil, FileText, RefreshCw, Loader2, Check, ChevronDown, Download } from "lucide-react";
import { INTAKE_QUESTIONS, type IntakeQuestionKey } from "@/lib/narrativeFromQa";
import StatusBadge from "./StatusBadge";

type QaPair = { q: string; a: string };

type DetailsSidebarProps = {
  submission: {
    business_name: string;
    business_type: string;
    owner_name: string;
    owner_phone: string;
    owner_email?: string;
    address: string;
    city: string;
    photos: string[];
    transcript?: string;
    /** The owner's typed interview, exactly as answered. Written only by the
     *  /start owner funnel — the creator funnel records audio and leaves it
     *  unset, which is why every read of it here is gated on the array. */
    interview_qa?: QaPair[];
    status: string;
    creator_payout?: number;
    created_at: number;
  };
  photoUrls: string[];
  transcriptionUpdatedAt?: number;

  qualityChecklist: {
    hasPhotos: boolean;
    hasAudioVideo: boolean;
    hasTranscript: boolean;
    businessInfoComplete: boolean;
    contactInfoComplete: boolean;
  };

  creator: { first_name?: string; last_name?: string; email?: string; phone?: string } | null;

  onEditBusinessInfo: () => void;
  onEditPhotos: () => void;
  onOpenLightbox: (index: number) => void;

  transcribing: boolean;
  onRetriggerTranscription: () => void;
  /** Zip every original photo + every AI-enhanced image and download it. */
  onDownloadMedia?: () => void;
  /** Progress text while the zip is being built ("Downloading 3/16…"); null when idle. */
  mediaZipProgress?: string | null;
  /** How many AI-enhanced images the submission has (earlier renders included). */
  enhancedCount?: number;
};

type SectionKey = "status" | "business" | "quality" | "creator" | "photos" | "intake" | "interview";

/** Match a stored pair back to its canonical question, accepting either the
 *  machine key or the display text.
 *
 *  This is a deliberate local copy of the rule in lib/narrativeFromQa (which
 *  keeps its matcher private), and it is safe for the same reason
 *  submitOwnerIntake's copy is: pairs are STORED with the canonical display
 *  text, so every matcher only ever sees strings straight out of
 *  INTAKE_QUESTIONS. A reworded question orphans nothing — anything that fails
 *  to match is still rendered, see buildIntakeRows. */
function normalizeQuestion(q: string): string {
  return (q ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const QUESTION_KEY_LOOKUP: ReadonlyMap<string, IntakeQuestionKey> = new Map(
  INTAKE_QUESTIONS.flatMap((entry) => [
    [normalizeQuestion(entry.q), entry.key] as const,
    [normalizeQuestion(entry.key), entry.key] as const,
  ]),
);

type IntakeRow = {
  id: string;
  q: string;
  /** Empty string = nothing stored for this question. */
  a: string;
  /** From INTAKE_QUESTIONS. A blank optional answer is ordinary; a blank
   *  required one means something went missing between the form and the row. */
  optional: boolean;
};

/**
 * Pair every canonical question with what the owner actually typed.
 *
 * Walks INTAKE_QUESTIONS rather than the stored array on purpose: blank answers
 * are never written (convex/ownerIntake normalizeQa skips them), so a question
 * the owner skipped is simply absent from the row — and an absence that renders
 * as nothing is exactly what made a dropped answer invisible in the first place.
 * Unrecognised pairs are appended rather than discarded for the same reason.
 */
function buildIntakeRows(qa: QaPair[]): IntakeRow[] {
  const answers = new Map<IntakeQuestionKey, string>();
  const extras: IntakeRow[] = [];

  qa.forEach((pair, index) => {
    const key = QUESTION_KEY_LOOKUP.get(normalizeQuestion(pair?.q));
    if (!key) {
      extras.push({
        id: `unmatched-${index}`,
        q: pair?.q || "Unlabelled question",
        a: pair?.a || "",
        optional: false,
      });
      return;
    }
    // First non-blank wins, matching buildNarrativeFromQa and normalizeQa.
    const answer = pair?.a ?? "";
    if (answer.trim().length > 0 && !answers.has(key)) answers.set(key, answer);
  });

  const rows = INTAKE_QUESTIONS.map<IntakeRow>((question) => ({
    id: question.key,
    q: question.q,
    a: answers.get(question.key) ?? "",
    optional: !!question.optional,
  }));

  return [...rows, ...extras];
}

function CollapsibleCard({
  sectionKey,
  title,
  isOpen,
  onToggle,
  headerActions,
  badge,
  children,
}: {
  sectionKey: SectionKey;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  headerActions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      {/* Header is a div (not a button) so it can legally contain action buttons inside */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-controls={`section-${sectionKey}`}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-neutral-50/80 transition-colors text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
          />
          <h3
            style={{ fontFamily: "var(--font-fraunces)" }}
            className="text-lg font-semibold text-neutral-900 truncate"
          >
            {title}
          </h3>
          {badge}
        </div>
        {headerActions && (
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {headerActions}
          </div>
        )}
      </div>
      {isOpen && (
        <div id={`section-${sectionKey}`} className="px-5 pb-5">
          {children}
        </div>
      )}
    </section>
  );
}

export default function DetailsSidebar({
  submission,
  photoUrls,
  transcriptionUpdatedAt,
  qualityChecklist,
  creator,
  onEditBusinessInfo,
  onEditPhotos,
  onOpenLightbox,
  transcribing,
  onRetriggerTranscription,
  onDownloadMedia,
  mediaZipProgress = null,
  enhancedCount = 0,
}: DetailsSidebarProps) {
  // All sections expanded by default
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());

  const toggle = (key: SectionKey) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isOpen = (key: SectionKey) => !collapsed.has(key);

  const copyBusinessInfo = () => {
    const info = [
      `Business Name: ${submission.business_name}`,
      `Business Type: ${submission.business_type}`,
      `Owner Name: ${submission.owner_name}`,
      `Phone: ${submission.owner_phone}`,
      `Email: ${submission.owner_email || "N/A"}`,
      `City: ${submission.city}`,
      `Address: ${submission.address}`,
    ].join("\n");
    navigator.clipboard.writeText(info);
  };

  // Gated on the DATA, never on contentSource: `interviewQa` is optional on the
  // schema and unset on every creator-recorded row, so an empty array must
  // render nothing at all — and any future funnel that writes real pairs gets
  // this section for free.
  const intakeQa = submission.interview_qa ?? [];
  const intakeRows = intakeQa.length > 0 ? buildIntakeRows(intakeQa) : null;
  const intakeAnsweredCount = intakeRows?.filter((row) => row.a.trim().length > 0).length ?? 0;

  const copyIntakeAnswers = () => {
    if (!intakeRows) return;
    const text = intakeRows
      .map((row) => `${row.q}\n${row.a.trim() || "(not answered)"}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
  };

  const checklistItems = [
    { label: `Has Photos (${submission.photos?.length || 0})`, done: qualityChecklist.hasPhotos },
    { label: "Has Audio/Video", done: qualityChecklist.hasAudioVideo },
    { label: "Has Transcript", done: qualityChecklist.hasTranscript },
    { label: "Business Info Complete", done: qualityChecklist.businessInfoComplete },
    { label: "Contact Info Complete", done: qualityChecklist.contactInfoComplete },
  ];

  const completedCount = checklistItems.filter((i) => i.done).length;

  return (
    <aside className="space-y-3">
      {/* Status card */}
      <CollapsibleCard
        sectionKey="status"
        title="Status"
        isOpen={isOpen("status")}
        onToggle={() => toggle("status")}
        badge={<StatusBadge status={submission.status} size="sm" />}
      >
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 mb-1">Creator payout</p>
            <p
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-xl font-bold text-amber-700"
            >
              ₱{(submission.creator_payout ?? 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 mb-1">Submitted on</p>
            <p className="text-sm font-medium text-neutral-900">
              {new Date(submission.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <p className="text-xs text-neutral-500">
              {new Date(submission.created_at).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </CollapsibleCard>

      {/* Business information */}
      <CollapsibleCard
        sectionKey="business"
        title="Business Information"
        isOpen={isOpen("business")}
        onToggle={() => toggle("business")}
        headerActions={
          <>
            <IconBtn onClick={copyBusinessInfo} title="Copy as text">
              <Copy className="w-3.5 h-3.5" />
            </IconBtn>
            <IconBtn onClick={onEditBusinessInfo} title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </IconBtn>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 text-sm pt-1">
          <DetailField label="Business Name" value={submission.business_name} />
          <DetailField label="Business Type" value={submission.business_type} />
          <DetailField label="Owner" value={submission.owner_name} />
          <DetailField label="Phone" value={submission.owner_phone} />
          <DetailField label="Email" value={submission.owner_email || "—"} full />
          <DetailField label="Location" value={`${submission.address}, ${submission.city}`} full />
        </div>
      </CollapsibleCard>

      {/* Quality Checklist */}
      <CollapsibleCard
        sectionKey="quality"
        title="Quality Checklist"
        isOpen={isOpen("quality")}
        onToggle={() => toggle("quality")}
        badge={
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            {completedCount}/{checklistItems.length}
          </span>
        }
      >
        <ul className="space-y-2 pt-1">
          {checklistItems.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <Check
                className={`w-3.5 h-3.5 shrink-0 ${item.done ? "text-amber-600" : "text-neutral-300"}`}
                strokeWidth={3}
              />
              <span className={item.done ? "text-neutral-800" : "text-neutral-400"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </CollapsibleCard>

      {/* Creator info */}
      {creator && (
        <CollapsibleCard
          sectionKey="creator"
          title="Creator Info"
          isOpen={isOpen("creator")}
          onToggle={() => toggle("creator")}
        >
          <div className="space-y-2.5 pt-1">
            <DetailField
              label="Name"
              value={`${creator.first_name || ""} ${creator.last_name || ""}`.trim() || "—"}
              full
            />
            <DetailField label="Email" value={creator.email || "—"} full />
            <DetailField label="Phone" value={creator.phone || "—"} full />
          </div>
        </CollapsibleCard>
      )}

      {/* Photos */}
      <CollapsibleCard
        sectionKey="photos"
        title={`Photos (${submission.photos?.length || 0})`}
        isOpen={isOpen("photos")}
        onToggle={() => toggle("photos")}
        headerActions={
          <IconBtn onClick={onEditPhotos} title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </IconBtn>
        }
      >
        {(submission.photos?.length || 0) === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">No photos</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {submission.photos.map((url, i) => {
              const raw = photoUrls?.[i] || url;
              const resolvedUrl = raw?.startsWith("http") ? raw : null;
              if (!resolvedUrl) return null;
              return (
                <button
                  key={i}
                  onClick={() => onOpenLightbox(i)}
                  className="relative aspect-square bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200 hover:border-amber-300 transition-colors group"
                >
                  <Image
                    src={resolvedUrl}
                    alt={`Photo ${i + 1}`}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
        {onDownloadMedia && ((submission.photos?.length || 0) > 0 || enhancedCount > 0) && (
          <button
            type="button"
            onClick={onDownloadMedia}
            disabled={!!mediaZipProgress}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[40px] px-3 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:border-amber-300 transition-colors disabled:opacity-60"
          >
            {mediaZipProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {mediaZipProgress || (
              <span>
                Download all (.zip)
                <span className="text-neutral-400 font-normal">
                  {" "}· {submission.photos?.length || 0} photo{(submission.photos?.length || 0) === 1 ? "" : "s"} + {enhancedCount} AI
                </span>
              </span>
            )}
          </button>
        )}
      </CollapsibleCard>

      {/* Owner's typed answers — owner-intake rows only.
          Sits directly above the transcript card because that transcript is
          SYNTHESIZED from these answers: seeing the owner's words next to the
          prose is the only way an admin can catch the narrative builder
          dropping one, which is otherwise invisible to owner, admin and logs. */}
      {intakeRows && (
        <CollapsibleCard
          sectionKey="intake"
          title="Owner's Answers"
          isOpen={isOpen("intake")}
          onToggle={() => toggle("intake")}
          badge={
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {intakeAnsweredCount}/{intakeRows.length}
            </span>
          }
          headerActions={
            <IconBtn onClick={copyIntakeAnswers} title="Copy as text">
              <Copy className="w-3.5 h-3.5" />
            </IconBtn>
          }
        >
          <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 mb-2 pt-1">
            Typed by the owner — verbatim
          </p>
          <ol className="space-y-3">
            {intakeRows.map((row, i) => (
              <li key={row.id}>
                <p className="text-xs font-semibold text-neutral-900 mb-1 break-words">
                  {i + 1}. {row.q}
                </p>
                {row.a.trim().length > 0 ? (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    {/* pre-wrap keeps the owner's own line breaks; break-words
                        is what stops a pasted URL or an unspaced Tagalog run
                        blowing out the 360px sidebar. */}
                    <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap break-words">
                      {row.a}
                    </p>
                  </div>
                ) : (
                  // An unanswered OPTIONAL question is ordinary. An unanswered
                  // required one is not — /start and submitOwnerIntake both
                  // enforce it — so it gets the louder treatment.
                  <div
                    className={`rounded-xl border border-dashed px-3 py-2 ${
                      row.optional ? "border-neutral-200" : "border-amber-300 bg-amber-50/60"
                    }`}
                  >
                    <p
                      className={`text-xs ${
                        row.optional ? "text-neutral-400" : "text-amber-800 font-semibold"
                      }`}
                    >
                      {row.optional ? "Not answered (optional)" : "No answer stored"}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </CollapsibleCard>
      )}

      {/* Interview transcript */}
      <CollapsibleCard
        sectionKey="interview"
        title="Interview"
        isOpen={isOpen("interview")}
        onToggle={() => toggle("interview")}
        badge={
          submission.transcript ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Generated
            </span>
          ) : undefined
        }
        headerActions={
          <IconBtn
            onClick={onRetriggerTranscription}
            disabled={transcribing}
            title="Regenerate transcription"
          >
            {transcribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </IconBtn>
        }
      >
        <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 mb-2 pt-1">
          AI Transcript
        </p>
        {transcribing ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-2 bg-neutral-200 rounded w-full" />
            <div className="h-2 bg-neutral-200 rounded w-5/6" />
            <div className="h-2 bg-neutral-200 rounded w-4/6" />
          </div>
        ) : submission.transcript ? (
          <div className="bg-neutral-50 rounded-xl p-3 max-h-32 overflow-y-auto">
            <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {submission.transcript}
            </p>
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-xl p-3 text-center">
            <FileText className="w-5 h-5 text-neutral-300 mx-auto mb-1" />
            <p className="text-xs text-neutral-400">No transcript yet</p>
          </div>
        )}
        {transcriptionUpdatedAt && submission.transcript && (
          <p className="text-[10px] text-neutral-400 mt-2">
            Updated {new Date(transcriptionUpdatedAt).toLocaleDateString()}
          </p>
        )}
      </CollapsibleCard>
    </aside>
  );
}

function IconBtn({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 text-neutral-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function DetailField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 mb-0.5">{label}</p>
      <p className="text-sm text-neutral-900 break-words">{value}</p>
    </div>
  );
}
