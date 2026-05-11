import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorOverlay, LoadingOverlay } from '../components';
import { getSharedStorage, type StorageStats } from '../services/storage';

export default function StatsScreen() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const storage = await getSharedStorage();
      setStats(await storage.getStats());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  }, []);

  const clearAll = useCallback(async () => {
    setBusy(true);
    try {
      const storage = await getSharedStorage();
      await storage.clear();
      setStats(await storage.getStats());
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <ErrorOverlay title="Stats unavailable" error={error} />;
  }
  if (!stats) {
    return <LoadingOverlay title="Reading storage…" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>TILE CACHE</Text>

      <Row label="Tile coords" value={stats.tileCount.toLocaleString()} />
      <Row label="Blobs (post-dedup)" value={stats.blobCount.toLocaleString()} />
      <Row
        label="Dedup ratio"
        value={stats.blobCount > 0 ? `${stats.dedupRatio.toFixed(2)}×` : '—'}
        hint={stats.dedupRatio > 1 ? 'storage saved' : '1× = no dedup yet'}
      />
      <Row label="Cached bytes" value={formatBytes(stats.totalBytes)} />

      <View style={styles.actions}>
        <Button label="REFRESH" onPress={load} disabled={busy} />
        <Button label="CLEAR CACHE" onPress={clearAll} disabled={busy} destructive />
      </View>
    </ScrollView>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        destructive && styles.buttonDestructive,
        (pressed || disabled) && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonLabel, destructive && styles.buttonLabelDestructive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0d' },
  content: { padding: 20, paddingTop: 8 },
  heading: {
    color: '#7fa67a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f3a1c',
  },
  rowLabel: { color: '#a8b5a3', fontSize: 14 },
  rowRight: { alignItems: 'flex-end' },
  rowValue: { color: '#e6f0e0', fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rowHint: { color: '#5a6e58', fontSize: 11, marginTop: 2 },
  actions: { marginTop: 28, gap: 12 },
  button: {
    backgroundColor: '#11241a',
    borderWidth: 1,
    borderColor: '#1f3a1c',
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDestructive: { borderColor: '#5a2018' },
  buttonPressed: { opacity: 0.6 },
  buttonLabel: { color: '#7fa67a', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  buttonLabelDestructive: { color: '#d96b4a' },
});
