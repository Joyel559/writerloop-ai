import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const scoreHistory = [74, 79, 81, 85, 87, 89];

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-sea">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="mt-4 font-[var(--font-heading)] text-3xl font-bold">Document Health Dashboard</h1>
      <p className="mt-1 text-slate-700">Track writing quality progression across drafts and feedback cycles.</p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Overall Score" value="89" />
        <Metric title="Documents" value="14" />
        <Metric title="Feedback Reports" value="53" />
        <Metric title="Clarity Trend" value="+9%" />
      </section>

      <section className="card-glass mt-6 rounded-2xl p-5">
        <h2 className="font-[var(--font-heading)] text-xl font-semibold">Improvement Trend</h2>
        <div className="mt-4 flex items-end gap-3">
          {scoreHistory.map((score, index) => (
            <div key={score + index} className="flex w-full flex-col items-center gap-2">
              <div
                className="w-full rounded-md bg-gradient-to-b from-sea/80 to-sea/35"
                style={{ height: `${Math.max(18, score)}%` }}
                title={`${score}`}
              />
              <span className="text-xs text-slate-600">W{index + 1}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="card-glass rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}
