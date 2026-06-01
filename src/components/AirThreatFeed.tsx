import { useEffect, useRef, useState } from "react";
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

export function AirThreatFeed({ limit = 12 }: { limit?: number }) {
  const { t } = useTranslation();
  const [data, setData] = useState<FeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`https://${projectId}.functions.supabase.co/kpszsu-feed`, {
        headers: { apikey, Authorization: `Bearer ${apikey}` },
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

  const msgs = (data?.messages ?? []).slice(0, limit);

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
          {data && (
            <span>
              {t("airAlerts.lastUpdate")}: {new Date(data.updatedAt).toUTCString().slice(17, 22)} UTC
            </span>
          )}
        </div>
      </div>
      <ul className="divide-y divide-border max-h-[520px] overflow-y-auto">
        {msgs.map((m) => (
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
            <p className="mt-1.5 whitespace-pre-line text-sm leading-snug">{m.text}</p>
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10px] font-mono text-muted-foreground underline-offset-4 hover:underline"
            >
              t.me/{m.id} →
            </a>
          </li>
        ))}
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
