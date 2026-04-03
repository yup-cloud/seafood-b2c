interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
  tone?: "blue" | "green" | "amber" | "red";
}

export function MetricCard({ label, value, hint, tone = "blue" }: MetricCardProps) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <p className="metric-label">{label}</p>
      <strong className="metric-value">{value}</strong>
      <p className="metric-hint">{hint}</p>
    </article>
  );
}
