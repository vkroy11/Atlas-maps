import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface BaseProps {
  title: string;
  subtitle?: string;
}

export function LoadingOverlay({ title = 'Loading', subtitle }: Partial<BaseProps>) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#7fa67a" size="large" />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

interface ErrorProps extends BaseProps {
  error: Error;
}

export function ErrorOverlay({ title, subtitle, error }: ErrorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorTag}>ERROR</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.message} numberOfLines={6}>
        {error.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0f0d',
    padding: 24,
  },
  title: {
    color: '#e6f0e0',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    letterSpacing: 1,
  },
  subtitle: {
    color: '#7fa67a',
    fontSize: 13,
    marginTop: 6,
  },
  errorTag: {
    color: '#d96b4a',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  message: {
    color: '#a8b5a3',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    maxWidth: 360,
  },
});
