import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function HeaderActions() {
  return (
    <View style={styles.headerRight}>
      <Link href="/stats" asChild>
        <Pressable
          style={({ pressed }) => [styles.headerLink, pressed && styles.headerLinkPressed]}
        >
          <Text style={styles.headerLinkText}>STATS</Text>
        </Pressable>
      </Link>
      <Link href="/settings" asChild>
        <Pressable
          style={({ pressed }) => [styles.headerLink, pressed && styles.headerLinkPressed]}
        >
          <Text style={styles.headerLinkText}>OPS</Text>
        </Pressable>
      </Link>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0a0f0d' },
            headerTintColor: '#e6f0e0',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#0a0f0d' },
          }}
        >
          <Stack.Screen
            name="index"
            options={{ title: 'Atlas Offline', headerRight: HeaderActions }}
          />
          <Stack.Screen name="stats" options={{ title: 'Cache Stats' }} />
          <Stack.Screen name="settings" options={{ title: 'Operations' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', gap: 14, marginRight: 8 },
  headerLink: { paddingHorizontal: 6, paddingVertical: 4 },
  headerLinkPressed: { opacity: 0.6 },
  headerLinkText: {
    color: '#7fa67a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
