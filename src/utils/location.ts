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

export interface ReverseGeocodedPlace {
    city: string | null;
    region: string | null;
    country: string | null;
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

export async function reverseGeocodePlace(lat: number, lng: number): Promise<ReverseGeocodedPlace | null> {
    try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (!place) return null;

        const city = place.city ?? place.district ?? null;
        const region = place.subregion ?? place.region ?? null;
        const country = place.country ?? place.isoCountryCode ?? null;
        if (!city && !region && !country) return null;

        return { city, region, country };
    } catch {
        return null;
    }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const place = await reverseGeocodePlace(lat, lng);
    return place?.city ?? place?.region ?? null;
}
