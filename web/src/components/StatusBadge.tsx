import { formatStatusLabel } from "../lib/format";

interface StatusBadgeProps {
  value: string;
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const tone = resolveTone(value);
  return <span className={`status-badge ${tone}`}>{formatStatusLabel(value)}</span>;
}

function resolveTone(value: string) {
  if (value.includes("confirmed") || value.includes("ready") || value.includes("completed")) {
    return "success";
  }
  if (value.includes("wait") || value.includes("pending") || value.includes("quoted")) {
    return "pending";
  }
  if (value.includes("review") || value.includes("partial") || value.includes("over")) {
    return "warning";
  }
  if (value.includes("cancel") || value.includes("failed") || value.includes("sold_out")) {
    return "danger";
  }
  return "neutral";
}
