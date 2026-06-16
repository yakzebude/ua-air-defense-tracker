import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";


// Item shape returned by the `air-attack-news` edge function
interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes
// Constant scroll speed (px/sec) — yields a smooth, predictable feel
// regardless of how many headlines are in the loop.
const SCROLL_SPEED_PX_S = 1000;

export const NewsTicker = () => {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timerRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState<number>(40);

  // Fetch helper — calls edge function directly with ?lang= so it can translate titles
  const load = async (currentLang: string) => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const url = `https://${projectId}.functions.supabase.co/air-attack-news?lang=${currentLang}`;
      const res = await fetch(url, { headers: { apikey, Authorization: `Bearer ${apikey}` } });
      if (!res.ok) throw new Error(String(res.status));
      const payload = await res.json();
      const next: NewsItem[] = payload?.items ?? [];
      const seen = new Set<string>();
      setItems(next.filter((i) => (seen.has(i.id) ? false : seen.add(i.id))));
      setError(false);
    } catch (_e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load(lang);
    timerRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") load(lang);
    }, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lang]);

  // Measure one rendered set and derive duration from a constant scroll speed.
  // Because we render the set twice and translate by -50%, the loop is seamless
  // when duration = (width_of_one_set) / SPEED.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el || items.length === 0) return;
    const recompute = () => {
      const w = el.scrollWidth;
      if (w > 0) setDuration(Math.max(20, w / SCROLL_SPEED_PX_S));
    };
    recompute();
    // Re-measure once webfonts finish loading (avoids width drift mid-scroll).
    const fonts = (document as any).fonts;
    if (fonts?.ready) fonts.ready.then(recompute).catch(() => {});
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [items]);

  // Status / fallback content
  const status =
    loading ? "Loading air attack updates…" :
    items.length === 0 ? "No recent air attack updates available" :
    null;

  return (
    <div
      className="group w-full bg-[#111] text-white border-b border-white/10 overflow-hidden"
      style={{ height: 43 }}
      aria-label="Live news ticker — Russian air attacks against Ukraine"
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-stretch">
        {/* LIVE NEWS badge */}
        <div className="flex items-center gap-2 px-3 border-r border-white/10 shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-red-500 font-bold">
          Live News
        </div>

        {/* Marquee / status */}
        <div className="relative flex-1 overflow-hidden">
          {status ? (
            <div className="flex h-full items-center px-4 font-mono text-[13px] text-white/70">
              {status}
            </div>
          ) : (
            <div
              ref={trackRef}
              className="flex h-full items-center whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused] motion-reduce:!animation-none"
              style={{
                animation: `ticker-scroll ${duration}s linear infinite`,
              }}
            >
              {/* Render the list twice for a seamless loop */}
              {[0, 1].map((dup) => (
                <div
                  key={dup}
                  ref={dup === 0 ? measureRef : undefined}
                  className="flex items-center shrink-0"
                  aria-hidden={dup === 1}
                >
                  {items.map((item, index) => (
                    <a
                      key={`${dup}-${item.id}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-4 font-mono text-[13px] text-white hover:text-amber-400 transition-colors"
                    >
                      {index > 0 && (
                        <span className="pr-4 text-white/30">•</span>
                      )}
                      <span className="text-white/40 mr-2">[{item.source}]</span>
                      {item.title}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsTicker;
