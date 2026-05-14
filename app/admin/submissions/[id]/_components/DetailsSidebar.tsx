"use client";

import { useState, ReactNode } from "react";
import Image from "next/image";
import { Copy, Pencil, FileText, RefreshCw, Loader2, Check, ChevronDown } from "lucide-react";
import StatusBadge from "./StatusBadge";

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
};

type SectionKey = "status" | "business" | "quality" | "creator" | "photos" | "interview";

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
              className="text-xl font-bold text-emerald-700"
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
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            {completedCount}/{checklistItems.length}
          </span>
        }
      >
        <ul className="space-y-2 pt-1">
          {checklistItems.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <Check
                className={`w-3.5 h-3.5 shrink-0 ${item.done ? "text-emerald-600" : "text-neutral-300"}`}
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
                  className="relative aspect-square bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200 hover:border-emerald-300 transition-colors group"
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
      </CollapsibleCard>

      {/* Interview transcript */}
      <CollapsibleCard
        sectionKey="interview"
        title="Interview"
        isOpen={isOpen("interview")}
        onToggle={() => toggle("interview")}
        badge={
          submission.transcript ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
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
      className="p-1.5 text-neutral-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
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
