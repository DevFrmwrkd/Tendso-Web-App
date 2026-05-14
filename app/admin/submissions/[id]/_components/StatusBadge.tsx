type StatusKey =
  | "submitted"
  | "in_review"
  | "website_generated"
  | "approved"
  | "deployed"
  | "pending_payment"
  | "paid"
  | "completed"
  | "rejected"
  | "unpublished"
  | (string & {});

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  submitted: { bg: "bg-neutral-100", text: "text-neutral-700", dot: "bg-neutral-400", label: "Submitted" },
  in_review: { bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-500", label: "In review" },
  website_generated: { bg: "bg-violet-50", text: "text-violet-800", dot: "bg-violet-500", label: "Website generated" },
  approved: { bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-500", label: "Approved" },
  deployed: { bg: "bg-sky-50", text: "text-sky-800", dot: "bg-sky-500", label: "Deployed" },
  pending_payment: { bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-500", label: "Pending payment" },
  paid: { bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-600", label: "Paid" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-600", label: "Completed" },
  rejected: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", label: "Rejected" },
  unpublished: { bg: "bg-neutral-100", text: "text-neutral-700", dot: "bg-neutral-500", label: "Unpublished" },
};

export default function StatusBadge({
  status,
  size = "md",
}: {
  status: StatusKey;
  size?: "sm" | "md";
}) {
  const style = STATUS_STYLES[status] || {
    bg: "bg-neutral-100",
    text: "text-neutral-700",
    dot: "bg-neutral-400",
    label: status.replace(/_/g, " "),
  };

  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[10px] gap-1.5" : "px-2.5 py-1 text-xs gap-2";
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${sizeClass} ${style.bg} ${style.text}`}
    >
      <span className={`${dotSize} rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}
