// Client-side Firestore Quota Tracker and Estimator
// Persists counts to localStorage and resets them daily according to the user's local timezone.

export interface QuotaStats {
  date: string; // YYYY-MM-DD
  reads: number;
  writes: number;
  deletes: number;
}

const STORAGE_KEY = "vision_vault_quota_stats";

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getQuotaStats(): QuotaStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const today = getTodayString();
    if (raw) {
      const parsed = JSON.parse(raw) as QuotaStats;
      if (parsed.date === today) {
        return parsed;
      }
    }
    // Return empty stats for today if none exist or date has changed
    const newStats: QuotaStats = {
      date: today,
      reads: 0,
      writes: 0,
      deletes: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
    return newStats;
  } catch (err) {
    console.warn("[Quota Tracker] Failed reading storage:", err);
    return { date: getTodayString(), reads: 0, writes: 0, deletes: 0 };
  }
}

export function updateQuotaStats(updater: (stats: QuotaStats) => void): QuotaStats {
  try {
    const stats = getQuotaStats();
    updater(stats);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    // Dispatch custom event to notify React components instantly
    window.dispatchEvent(new CustomEvent("quota_stats_updated", { detail: stats }));
    return stats;
  } catch (err) {
    console.warn("[Quota Tracker] Failed saving stats:", err);
    return getQuotaStats();
  }
}

export function recordReads(count: number) {
  if (count <= 0) return;
  updateQuotaStats((stats) => {
    stats.reads += count;
  });
}

export function recordWrites(count: number) {
  if (count <= 0) return;
  updateQuotaStats((stats) => {
    stats.writes += count;
  });
}

export function recordDeletes(count: number) {
  if (count <= 0) return;
  updateQuotaStats((stats) => {
    stats.deletes += count;
  });
}

export function resetQuotaStats(): QuotaStats {
  try {
    const newStats: QuotaStats = {
      date: getTodayString(),
      reads: 0,
      writes: 0,
      deletes: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
    window.dispatchEvent(new CustomEvent("quota_stats_updated", { detail: newStats }));
    return newStats;
  } catch (err) {
    console.warn("[Quota Tracker] Failed resetting stats:", err);
    return getQuotaStats();
  }
}

export const QUOTA_LIMITS = {
  reads: 50000,
  writes: 20000,
  deletes: 20000,
};
