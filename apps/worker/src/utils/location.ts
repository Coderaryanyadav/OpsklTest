import { calculateDistanceKm } from '@opskil/shared';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface LocalityZone {
  id: string;
  label: string;
  coords: GeoLocation;
}

export const ALL_MUMBAI_ZONE: LocalityZone = {
  id: 'all',
  label: 'All Mumbai Zones',
  coords: { latitude: 19.076, longitude: 72.8777, name: 'All Mumbai' },
};

export const MUMBAI_ZONES: LocalityZone[] = [
  ALL_MUMBAI_ZONE,
  {
    id: 'bkc',
    label: 'Bandra Kurla Complex (BKC)',
    coords: { latitude: 19.066, longitude: 72.868, name: 'BKC' },
  },
  {
    id: 'goregaon',
    label: 'Goregaon & NESCO',
    coords: { latitude: 19.1482, longitude: 72.853, name: 'Goregaon East' },
  },
  {
    id: 'worli_sobo',
    label: 'Worli & South Mumbai',
    coords: { latitude: 19.0178, longitude: 72.818, name: 'Worli / SoBo' },
  },
  {
    id: 'andheri',
    label: 'Andheri & Western Suburbs',
    coords: { latitude: 19.1136, longitude: 72.8697, name: 'Andheri' },
  },
  {
    id: 'powai',
    label: 'Powai & Central Mumbai',
    coords: { latitude: 19.1176, longitude: 72.906, name: 'Powai' },
  },
  {
    id: 'navi_mumbai',
    label: 'Navi Mumbai (Vashi / CIDCO)',
    coords: { latitude: 19.076, longitude: 72.998, name: 'Navi Mumbai' },
  },
  {
    id: 'thane',
    label: 'Thane & Suburbs',
    coords: { latitude: 19.2183, longitude: 72.9781, name: 'Thane' },
  },
];

/**
 * Returns estimated distance in km between worker's location and shift venue coordinates.
 * Returns null if either coordinate set is missing.
 */
export function estimateDistance(
  workerLocation: GeoLocation | null,
  venueLat?: number | null,
  venueLng?: number | null
): number | null {
  if (!workerLocation || venueLat == null || venueLng == null) {
    return null;
  }
  return calculateDistanceKm(
    workerLocation.latitude,
    workerLocation.longitude,
    venueLat,
    venueLng
  );
}
