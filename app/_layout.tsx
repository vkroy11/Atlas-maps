import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0a0f0d' },
            headerTintColor: '#e6f0e0',
            contentStyle: { backgroundColor: '#0a0f0d' },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Atlas Offline' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
