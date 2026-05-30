import { useEffect, useRef, useState } from "react";
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

export const NewsTicker = () => {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timerRef = useRef<number | null>(null);

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

  // Status / fallback content
  const status =
    loading ? "Loading air attack updates…" :
    items.length === 0 ? "No recent air attack updates available" :
    null;

  return (
    <div
      className="group w-full bg-[#111] text-white border-b border-white/10 overflow-hidden"
      style={{ height: 36 }}
      aria-label="Live news ticker — Russian air attacks against Ukraine"
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-stretch">
        {/* LIVE badge */}
        <div className="flex items-center gap-2 px-3 border-r border-white/10 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em]">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          Live
        </div>

        {/* Marquee / status */}
        <div className="relative flex-1 overflow-hidden">
          {status ? (
            <div className="flex h-full items-center px-4 font-mono text-xs text-white/70">
              {status}
            </div>
          ) : (
            <div
              className="flex h-full items-center whitespace-nowrap will-change-transform [animation:ticker-scroll_90s_linear_infinite] group-hover:[animation-play-state:paused]"
            >
              {/* Render the list twice for a seamless loop */}
              {[0, 1].map((dup) => (
                <div key={dup} className="flex items-center shrink-0" aria-hidden={dup === 1}>
                  {items.map((item) => (
                    <a
                      key={`${dup}-${item.id}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 font-mono text-xs text-white hover:text-amber-400 transition-colors"
                    >
                      <span className="text-white/40 mr-2">[{item.source}]</span>
                      {item.title}
                      <span className="px-4 text-white/30">•</span>
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
