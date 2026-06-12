import { EditorShell } from "@/components/editor-shell";

export default function EditorPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="font-[var(--font-heading)] text-3xl font-bold text-ink">Editor App</h1>
        <p className="mt-1 text-slate-700">
          Write with Gemini live spelling and grammar correction, then run AI analysis, rewrites, and reader simulation.
        </p>
      </header>
      <EditorShell />
    </main>
  );
}
