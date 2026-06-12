"use client";

import dynamic from "next/dynamic";

const ReaderShell = dynamic(
  () => import("@/components/reader-shell").then((mod) => mod.ReaderShell),
  { ssr: false },
);

export default function ReaderPage() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden">
      <ReaderShell />
    </main>
  );
}
