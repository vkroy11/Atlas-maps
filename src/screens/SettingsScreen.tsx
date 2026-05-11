import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { LoadingOverlay } from '../components';
import {
  DEFAULT_PREFETCH_SETTINGS,
  loadPrefetchSettings,
  savePrefetchSettings,
  type PrefetchSettings,
} from '../services/prefetch';

const RADIUS_OPTIONS: PrefetchSettings['radius'][] = [1, 2, 3];
const RADIUS_LABEL: Record<PrefetchSettings['radius'], string> = {
  1: '3×3 (8 tiles)',
  2: '5×5 (24 tiles)',
  3: '7×7 (48 tiles)',
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<PrefetchSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPrefetchSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function update(patch: Partial<PrefetchSettings>) {
    if (!settings) return;
    const next: PrefetchSettings = { ...settings, ...patch };
    setSettings(next);
    await savePrefetchSettings(next);
  }

  if (!settings) {
    return <LoadingOverlay title="Loading settings…" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>PREDICTIVE PREFETCH</Text>
      <Text style={styles.helpText}>
        When you pan or zoom, neighboring tiles are silently fetched so the next swipe feels
        instant. Disable to save bandwidth.
      </Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Enabled</Text>
        <Switch
          value={settings.enabled}
          onValueChange={(v) => update({ enabled: v })}
          trackColor={{ false: '#1f3a1c', true: '#3a5a37' }}
          thumbColor={settings.enabled ? '#7fa67a' : '#5a6e58'}
        />
      </View>

      <Text style={[styles.heading, styles.headingSpaced]}>RADIUS</Text>
      <Text style={styles.helpText}>Larger radius = more tiles per move, more bandwidth.</Text>

      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS.map((r) => {
          const active = settings.radius === r;
          return (
            <Pressable
              key={r}
              onPress={() => update({ radius: r })}
              disabled={!settings.enabled}
              style={({ pressed }) => [
                styles.radiusBtn,
                active && styles.radiusBtnActive,
                (pressed || !settings.enabled) && styles.radiusBtnDimmed,
              ]}
            >
              <Text style={[styles.radiusBtnLabel, active && styles.radiusBtnLabelActive]}>
                r={r}
              </Text>
              <Text style={[styles.radiusBtnHint, active && styles.radiusBtnHintActive]}>
                {RADIUS_LABEL[r]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.heading, styles.headingSpaced]}>ADVANCED</Text>
      <Row label="Concurrency" value={String(settings.concurrency)} />
      <Row label="Defaults" value={`r=${DEFAULT_PREFETCH_SETTINGS.radius}, on`} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0d' },
  content: { padding: 20, paddingTop: 8 },
  heading: {
    color: '#7fa67a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 8,
  },
  headingSpaced: { marginTop: 28 },
  helpText: { color: '#5a6e58', fontSize: 12, marginBottom: 16, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f3a1c',
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f3a1c',
  },
  rowLabel: { color: '#a8b5a3', fontSize: 14 },
  kvValue: { color: '#e6f0e0', fontSize: 14, fontVariant: ['tabular-nums'] },
  radiusRow: { flexDirection: 'row', gap: 10 },
  radiusBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#11241a',
    borderWidth: 1,
    borderColor: '#1f3a1c',
    alignItems: 'center',
  },
  radiusBtnActive: { borderColor: '#7fa67a', backgroundColor: '#1a3a24' },
  radiusBtnDimmed: { opacity: 0.4 },
  radiusBtnLabel: { color: '#a8b5a3', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  radiusBtnLabelActive: { color: '#e6f0e0' },
  radiusBtnHint: { color: '#5a6e58', fontSize: 10, marginTop: 2 },
  radiusBtnHintActive: { color: '#7fa67a' },
});
