import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const REFRESH_MS = 60 * 1000;

type ThreatTag = "drone" | "cruise" | "ballistic" | "kab" | "fast" | "all_clear" | "info";

interface FeedMessage {
  id: string;
  url: string;
  ts: string;
  text: string;
  tags: ThreatTag[];
}

interface FeedPayload {
  updatedAt: string;
  channel: string;
  messages: FeedMessage[];
  stale?: boolean;
  error?: string;
}

const TAG_COLORS: Record<ThreatTag, string> = {
  drone: "bg-[hsl(var(--signal)/0.25)] text-foreground",
  cruise: "bg-[hsl(var(--signal)/0.4)] text-foreground",
  ballistic: "bg-[hsl(var(--signal)/0.6)] text-background",
  kab: "bg-[hsl(var(--signal)/0.3)] text-foreground",
  fast: "bg-[hsl(var(--signal)/0.2)] text-foreground",
  all_clear: "bg-muted text-muted-foreground",
  info: "bg-muted text-muted-foreground",
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Strip emoji / pictographic glyphs from feed text per user request. */
function stripEmoji(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .trim();
}


const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export function AirThreatFeed({ limit = 12 }: { limit?: number }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<FeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const timerRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  const targetLang = i18n.language?.slice(0, 2) ?? "en";
  const needsTranslation = targetLang !== "uk";

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    try {
      const res = await fetch(`https://${PROJECT_ID}.functions.supabase.co/kpszsu-feed`, {
        headers: { apikey: APIKEY, Authorization: `Bearer ${APIKEY}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    timerRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const msgs = useMemo(() => (data?.messages ?? []).slice(0, limit), [data, limit]);

  // Live translation: whenever the visible message set or language changes,
  // request translations for any messages we haven't translated yet.
  useEffect(() => {
    if (!needsTranslation || msgs.length === 0) return;
    const missing = msgs.filter((m) => !translations[`${targetLang}|${m.id}`]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      setTranslating(true);
      try {
        const res = await fetch(
          `https://${PROJECT_ID}.functions.supabase.co/translate-messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: APIKEY,
              Authorization: `Bearer ${APIKEY}`,
            },
            body: JSON.stringify({
              lang: targetLang,
              items: missing.map((m) => ({ id: m.id, text: m.text })),
            }),
          },
        );
        if (!res.ok) return;
        const payload = (await res.json()) as {
          translations: Record<string, string>;
        };
        if (cancelled) return;
        setTranslations((prev) => {
          const next = { ...prev };
          for (const [id, text] of Object.entries(payload.translations ?? {})) {
            next[`${targetLang}|${id}`] = text;
          }
          return next;
        });
      } catch {
        /* translation is best-effort */
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [msgs, targetLang, needsTranslation, translations]);

  return (
    <div className="rounded border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{t("threatFeed.title")}</h3>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {t("threatFeed.subtitle")}
          </p>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {loading && <span>{t("airAlerts.loading")}</span>}
          {error && !data && <span className="text-[hsl(var(--signal))]">{t("airAlerts.error")}</span>}
          {data && !loading && (
            <span>
              {t("airAlerts.lastUpdate")}: {new Date(data.updatedAt).toUTCString().slice(17, 22)} UTC
            </span>
          )}
        </div>
      </div>

      {needsTranslation && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                translating ? "bg-[hsl(var(--signal))] animate-pulse" : "bg-muted-foreground/60"
              }`}
              aria-hidden
            />
            {translating ? t("threatFeed.translating") : t("threatFeed.translatedBy")}
          </span>
        </div>
      )}

      <ul className="divide-y divide-border max-h-[520px] overflow-y-auto">
        {msgs.map((m) => {
          const key = `${targetLang}|${m.id}`;
          const translated = translations[key];
          const showOrig = showOriginal[m.id] || !needsTranslation;
          const displayText = !showOrig && translated ? translated : m.text;
          const hasToggle = needsTranslation && !!translated;
          return (
            <li key={m.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.tags.map((tg) => (
                    <span
                      key={tg}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${TAG_COLORS[tg]}`}
                    >
                      {t(`threatFeed.tags.${tg}`)}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                  {relTime(m.ts)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-snug">{stripEmoji(displayText)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  t.me/{m.id} →
                </a>
                {hasToggle && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowOriginal((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                    }
                    className="underline-offset-4 hover:underline"
                  >
                    {showOrig ? t("threatFeed.showTranslated") : t("threatFeed.showOriginal")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!msgs.length && !loading && (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">
            {t("threatFeed.empty")}
          </li>
        )}
      </ul>
      <div className="border-t border-border px-4 py-2 text-[10px] font-mono text-muted-foreground">
        {t("airAlerts.source")}:{" "}
        <a href="https://t.me/kpszsu" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
          @kpszsu
        </a>{" "}
        ({t("threatFeed.sourceLabel")})
      </div>
    </div>
  );
}

export default AirThreatFeed;
