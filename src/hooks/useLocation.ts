import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../api/client';

const STORAGE_KEY = 'last_known_location';
const MINIMUM_DISTANCE_KM = 5;

interface StoredCoords {
    lat: number;
    lng: number;
}

function haversineDistanceKm(a: StoredCoords, b: StoredCoords): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
        sinDLat * sinDLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.sqrt(h));
}

async function loadStoredCoords(): Promise<StoredCoords | null> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as StoredCoords) : null;
    } catch {
        return null;
    }
}

async function saveCoords(coords: StoredCoords): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
    } catch { }
}

/**
 * Requests foreground location permission, gets the current GPS position,
 * then patches the backend only when:
 *   - No previously stored location exists (first sync after login), OR
 *   - The user has moved more than MINIMUM_DISTANCE_KM since the last sync.
 *
 * Silently no-ops if permission is denied or GPS is unavailable.
 */
export async function syncLocationIfNeeded(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return;

    const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
    });

    const current: StoredCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
    };

    const stored = await loadStoredCoords();

    if (stored !== null) {
        const distance = haversineDistanceKm(stored, current);
        if (distance < MINIMUM_DISTANCE_KM) return;
    }

    await api.updateLocation(current.lat, current.lng);
    await saveCoords(current);
}
