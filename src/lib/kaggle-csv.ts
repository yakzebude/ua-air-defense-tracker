/**
 * Resolve the public URL for a synced Kaggle CSV.
 *
 * The data is refreshed once per day at 06:00 UTC by the `kaggle-sync` edge
 * function and served through the `kaggle-csv` edge function which reads
 * the latest copy from private Storage. A static CSV shipped with the build
 * is used as a fallback so the app still works if the function is briefly
 * unavailable.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export function kaggleCsvUrl(file: string): string {
  if (!SUPABASE_URL) return `/data/${file}`;
  return `${SUPABASE_URL}/functions/v1/kaggle-csv?file=${encodeURIComponent(file)}`;
}

export const STATIC_CSV_FALLBACK = (file: string) => `/data/${file}`;
