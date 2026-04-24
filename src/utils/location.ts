import * as Location from 'expo-location';

export interface Coords {
    latitude: number;
    longitude: number;
}

export async function getDeviceCoords(): Promise<Coords | null> {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
        return null;
    }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        return place?.city ?? place?.subregion ?? place?.region ?? null;
    } catch {
        return null;
    }
}
