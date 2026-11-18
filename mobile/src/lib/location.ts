import * as Location from 'expo-location';

export type Position = { latitude: number; longitude: number };

// A position this recent and close is good enough to find someone; it comes at once, even offline.
const recentMs = 2 * 60_000;
const recentAccuracyMeters = 200;
// SOS never waits longer than this for a new fix; without one, help goes out without the map.
const fixWaitMs = 5_000;

// Only while in use: SOS is asked for with the app open, and background location would bring the stores' stricter
// review. The setup and the profile ask for it, never the SOS screen, so no system dialog shows during an emergency.
export async function locationPermission(ask: boolean) {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted || !ask) {
    return current;
  }
  return Location.requestForegroundPermissionsAsync();
}

export async function helpPosition(): Promise<Position | null> {
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) {
      return null;
    }
    const position = await Location.getLastKnownPositionAsync({ maxAge: recentMs, requiredAccuracy: recentAccuracyMeters }) ??
      await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), fixWaitMs);
    return position && { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    // Location turned off in the phone's settings, or no fix at all.
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
