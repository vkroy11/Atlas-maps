import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PrefetchSettings {
  enabled: boolean;
  /** Same-zoom neighbor radius (1 = 3×3, 2 = 5×5, 3 = 7×7). */
  radius: 1 | 2 | 3;
  /** Maximum parallel prefetch fetches. */
  concurrency: number;
}

export const DEFAULT_PREFETCH_SETTINGS: PrefetchSettings = {
  enabled: true,
  radius: 1,
  concurrency: 4,
};

const STORAGE_KEY = 'atlas:prefetch-settings:v1';

export async function loadPrefetchSettings(): Promise<PrefetchSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFETCH_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PrefetchSettings>;
    return {
      enabled: parsed.enabled ?? DEFAULT_PREFETCH_SETTINGS.enabled,
      radius: clampRadius(parsed.radius ?? DEFAULT_PREFETCH_SETTINGS.radius),
      concurrency: clampConcurrency(parsed.concurrency ?? DEFAULT_PREFETCH_SETTINGS.concurrency),
    };
  } catch {
    return { ...DEFAULT_PREFETCH_SETTINGS };
  }
}

export async function savePrefetchSettings(settings: PrefetchSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort — settings persistence isn't critical.
  }
}

function clampRadius(r: number): 1 | 2 | 3 {
  if (r <= 1) return 1;
  if (r >= 3) return 3;
  return 2;
}

function clampConcurrency(c: number): number {
  if (!Number.isFinite(c) || c < 1) return 1;
  if (c > 16) return 16;
  return Math.floor(c);
}
