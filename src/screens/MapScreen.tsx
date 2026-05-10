import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>Atlas Offline</Text>
        <Text style={styles.subtitle}>Delhi NCR · zoom 10–16</Text>
        <Text style={styles.hint}>Map renderer wires up in Phase 3.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f0d',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#e6f0e0',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#7fa67a',
    fontSize: 14,
    marginTop: 8,
  },
  hint: {
    color: '#5a6e58',
    fontSize: 12,
    marginTop: 24,
  },
});
