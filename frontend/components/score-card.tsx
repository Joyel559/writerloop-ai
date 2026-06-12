type ScoreCardProps = {
  label: string;
  value: number;
};

export function ScoreCard({ label, value }: ScoreCardProps) {
  const tone =
    value >= 85
      ? "bg-emerald-100 text-emerald-800"
      : value >= 70
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  return (
    <div className="card-glass rounded-2xl p-4 fade-up">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-3 flex items-center justify-between">
        <strong className="text-3xl font-semibold text-ink">{value}</strong>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
          {value >= 85 ? "Strong" : value >= 70 ? "Good" : "Needs Work"}
        </span>
      </div>
    </div>
  );
}
