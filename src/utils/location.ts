import * as Location from 'expo-location';

export interface Coords {
    latitude: number;
    longitude: number;
}

export type DeviceLocationStatus = 'available' | 'denied' | 'services_off' | 'unavailable';

export interface DeviceLocationResult {
    status: DeviceLocationStatus;
    coords?: Coords;
}

export async function getDeviceCoords(): Promise<DeviceLocationResult> {
    try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) return { status: 'services_off' };

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') return { status: 'denied' };

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return {
            status: 'available',
            coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        };
    } catch {
        return { status: 'unavailable' };
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
