import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { extractCbzPageAssets, CbzPageAsset, revokeCbzAssets } from '@/lib/cbz';
import { getPdfMaxWidth, ReaderLayoutWidth, ReaderThemePalette } from './readerUtils';

interface ReaderCbzViewProps {
  file: ArrayBuffer;
  styles: ReaderThemePalette;
  layoutWidth: ReaderLayoutWidth;
  location: string | number;
  setLocation: React.Dispatch<React.SetStateAction<string | number>>;
  setNumPages: React.Dispatch<React.SetStateAction<number>>;
  onPageVisibleChange?: (page: number) => void;
}

export function ReaderCbzView({
  file,
  styles,
  layoutWidth,
  location,
  setLocation,
  setNumPages,
  onPageVisibleChange,
}: ReaderCbzViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const locationUnlockTimerRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const lastReportedPageRef = useRef(0);

  const [assets, setAssets] = useState<CbzPageAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileKey = useMemo(() => `cbz:${file.byteLength}`, [file.byteLength]);
  const maxWidth = useMemo(() => getPdfMaxWidth(layoutWidth), [layoutWidth]);

  useEffect(() => () => {
    if (locationUnlockTimerRef.current !== null) window.clearTimeout(locationUnlockTimerRef.current);
    if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let parsedAssets: CbzPageAsset[] = [];

    setIsLoading(true);
    setError(null);
    setAssets([]);
    setNumPages(0);
    lastReportedPageRef.current = 0;
    pageRefs.current = {};

    void (async () => {
      try {
        parsedAssets = await extractCbzPageAssets(file);
        if (cancelled) {
          revokeCbzAssets(parsedAssets);
          return;
        }
        setAssets(parsedAssets);
        setNumPages(parsedAssets.length);
        if (parsedAssets.length === 0) {
          setError('No images were found inside this CBZ archive.');
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load CBZ archive.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revokeCbzAssets(parsedAssets);
    };
  }, [file, fileKey, setNumPages]);

  const scrollToPage = (page: number, behavior: ScrollBehavior) => {
    const root = rootRef.current;
    const pageElement = pageRefs.current[page];
    if (!root || !pageElement) return;

    const targetTop = Math.max(0, pageElement.offsetTop - 10);
    if (Math.abs(root.scrollTop - targetTop) <= 2) return;

    isProgrammaticScrollRef.current = true;
    if (locationUnlockTimerRef.current !== null) window.clearTimeout(locationUnlockTimerRef.current);
    locationUnlockTimerRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      locationUnlockTimerRef.current = null;
    }, 360);

    root.scrollTo({ top: targetTop, behavior });
  };

  useEffect(() => {
    if (assets.length === 0) return;
    const desiredPage = typeof location === 'number' ? Math.max(1, Math.min(assets.length, Math.round(location))) : 1;
    const initialPage = desiredPage || 1;
    scrollToPage(initialPage, 'auto');
    if (typeof location !== 'number' || location !== initialPage) {
      setLocation(initialPage);
    }
    lastReportedPageRef.current = initialPage;
  }, [assets, location, setLocation]);

  const getVisiblePage = () => {
    const root = rootRef.current;
    if (!root || assets.length === 0) return 1;
    const centerY = root.scrollTop + root.clientHeight * 0.45;

    let bestPage = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    assets.forEach((asset) => {
      const node = pageRefs.current[asset.page];
      if (!node) return;
      const nodeCenter = node.offsetTop + node.clientHeight * 0.5;
      const distance = Math.abs(nodeCenter - centerY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPage = asset.page;
      }
    });

    return bestPage;
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root || assets.length === 0) return;

    const handleScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        const page = getVisiblePage();
        if (!isProgrammaticScrollRef.current && page !== lastReportedPageRef.current) {
          lastReportedPageRef.current = page;
          onPageVisibleChange?.(page);
          setLocation(page);
        }
        scrollRafRef.current = null;
      });
    };

    root.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => root.removeEventListener('scroll', handleScroll);
  }, [assets, onPageVisibleChange, setLocation]);

  useEffect(() => {
    if (assets.length === 0) return;
    if (typeof location !== 'number') return;
    const nextPage = Math.max(1, Math.min(assets.length, Math.round(location)));
    if (nextPage === lastReportedPageRef.current) return;
    scrollToPage(nextPage, 'smooth');
    lastReportedPageRef.current = nextPage;
  }, [assets.length, location]);

  return (
    <div ref={rootRef} className="h-full w-full overflow-auto px-2 pb-20 pt-6 sm:px-4">
      <div className="mx-auto w-full space-y-5" style={{ maxWidth }}>
        {assets.map((asset) => (
          <div
            key={asset.page}
            ref={(node) => {
              pageRefs.current[asset.page] = node;
            }}
            className={cn('relative overflow-hidden rounded-xl border shadow-[0_20px_42px_-34px_rgba(15,23,42,0.68)]', styles.sidebarBorder)}
            data-page-marker={asset.page}
          >
            <img
              src={asset.url}
              alt={`Page ${asset.page}`}
              className="block h-auto w-full bg-white"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <div className={cn('pointer-events-none absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm', styles.floatingToastBg, styles.floatingToastText)}>
              Page {asset.page}
            </div>
          </div>
        ))}
      </div>

      {isLoading && !error && (
        <div className={cn('fixed top-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs z-30', styles.floatingToastBg, styles.floatingToastText)}>
          Loading CBZ pages...
        </div>
      )}

      {error && (
        <div className="fixed top-20 left-1/2 z-30 -translate-x-1/2 rounded-full bg-red-500 px-4 py-2 text-xs text-white">
          CBZ load failed: {error}
        </div>
      )}
    </div>
  );
}
