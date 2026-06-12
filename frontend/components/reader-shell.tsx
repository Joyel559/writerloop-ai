"use client";

import { useState } from "react";

import { Book } from "@/lib/db";
import { Library } from "@/components/Library";
import { Reader } from "@/components/Reader";

type ReaderView = "library" | "reader";

export function ReaderShell() {
  const [view, setView] = useState<ReaderView>("library");
  const [currentBook, setCurrentBook] = useState<Book | null>(null);

  const openReader = (book: Book) => {
    setCurrentBook(book);
    setView("reader");
  };

  const backToLibrary = () => {
    setCurrentBook(null);
    setView("library");
  };

  if (view === "reader" && currentBook) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden text-ink">
        <Reader book={currentBook} onBack={backToLibrary} />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ink">
      <Library onSelectBook={openReader} />
    </div>
  );
}
