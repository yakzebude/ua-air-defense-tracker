import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const REFRESH_MS = 60 * 1000;
const COLLAPSED_VISIBLE = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

type ThreatTag = "drone" | "cruise" | "ballistic" | "kab" | "fast" | "all_clear" | "info";

const ALL_TAGS: ThreatTag[] = ["drone", "cruise", "ballistic", "kab", "fast", "all_clear", "info"];

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

export function AirThreatFeed() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<FeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<ThreatTag>>(new Set());
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

  // Messages within the last 24h, sorted newest first (server already sorts desc).
  const recentMsgs = useMemo(() => {
    const cutoff = Date.now() - WINDOW_MS;
    return (data?.messages ?? []).filter((m) => new Date(m.ts).getTime() >= cutoff);
  }, [data]);

  // Apply category filter on top of the 24h window.
  const msgs = useMemo(() => {
    if (activeTags.size === 0) return recentMsgs;
    return recentMsgs.filter((m) => m.tags.some((tg) => activeTags.has(tg)));
  }, [recentMsgs, activeTags]);

  const visibleMsgs = expanded ? msgs : msgs.slice(0, COLLAPSED_VISIBLE);
  const hiddenCount = Math.max(0, msgs.length - visibleMsgs.length);

  const toggleTag = (tag: ThreatTag) =>
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  // Translation: only request for currently visible messages.
  useEffect(() => {
    if (!needsTranslation || visibleMsgs.length === 0) return;
    const missing = visibleMsgs.filter((m) => !translations[`${targetLang}|${m.id}`]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
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
        const payload = (await res.json()) as { translations: Record<string, string> };
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleMsgs, targetLang, needsTranslation, translations]);

  return (
    <div className="flex h-full w-full flex-col rounded border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{t("threatFeed.title")}</h3>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {t("threatFeed.last24h")} · {t("threatFeed.subtitle")}
          </p>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {loading && <span>{t("airAlerts.loading")}</span>}
          {error && !data && <span className="text-[hsl(var(--signal))]">{t("airAlerts.error")}</span>}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={() => setActiveTags(new Set())}
          className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
            activeTags.size === 0
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("threatFeed.filterAll")}
        </button>
        {ALL_TAGS.map((tg) => {
          const active = activeTags.has(tg);
          return (
            <button
              key={tg}
              type="button"
              onClick={() => toggleTag(tg)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                active
                  ? TAG_COLORS[tg] + " ring-1 ring-foreground/40"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`threatFeed.tags.${tg}`)}
            </button>
          );
        })}
      </div>

      <ul
        className={`flex-1 divide-y divide-border overflow-y-auto ${
          expanded ? "max-h-[640px]" : ""
        }`}
      >
        {visibleMsgs.map((m) => {
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
        {!visibleMsgs.length && !loading && (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">
            {activeTags.size > 0 ? t("threatFeed.noMatch") : t("threatFeed.empty")}
          </li>
        )}
      </ul>

      {/* Expand / collapse */}
      {(hiddenCount > 0 || expanded) && msgs.length > COLLAPSED_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="border-t border-border px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-foreground hover:bg-muted/40 transition-colors"
        >
          {expanded
            ? t("threatFeed.showLess")
            : t("threatFeed.showMore", { count: hiddenCount })}
        </button>
      )}

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
