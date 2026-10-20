/**
 * Opskl Mumbai Geocoding & Landmark Engine
 * Resolves event venues to precise street-level coordinates for 300m geofence validation.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ResolvedVenueLocation {
  coordinates: Coordinates;
  source: 'known_venue' | 'nominatim' | 'zone_centroid';
  matchedName?: string;
}

export const MUMBAI_ZONE_CENTROIDS: Record<string, Coordinates> = {
  'Bandra Kurla Complex (BKC)': { lat: 19.066, lng: 72.868 },
  'Goregaon & NESCO': { lat: 19.1482, lng: 72.853 },
  'Worli & South Mumbai': { lat: 19.0178, lng: 72.818 },
  'Andheri & Western Suburbs': { lat: 19.1136, lng: 72.8697 },
  'Powai & Central Mumbai': { lat: 19.1176, lng: 72.906 },
  'Navi Mumbai (Vashi / CIDCO)': { lat: 19.076, lng: 72.998 },
  'Thane & Suburbs': { lat: 19.2183, lng: 72.9781 },
};

export const KNOWN_MUMBAI_VENUES: Record<
  string,
  Coordinates & { aliases: string[] }
> = {
  'Jio World Convention Centre': {
    lat: 19.0645,
    lng: 72.8687,
    aliases: [
      'jio world convention',
      'jwcc',
      'jio convention centre',
      'jio convention center',
      'jio world bkc',
      'jio centre bkc',
    ],
  },
  'Jio World Garden': {
    lat: 19.0664,
    lng: 72.8682,
    aliases: ['jio world garden', 'jio garden', 'jio garden bkc'],
  },
  'Jio World Drive': {
    lat: 19.0628,
    lng: 72.8649,
    aliases: ['jio world drive', 'jio drive bkc'],
  },
  'NESCO Exhibition Centre': {
    lat: 19.1482,
    lng: 72.853,
    aliases: [
      'nesco',
      'bombay exhibition centre',
      'bombay exhibition center',
      'bec goregaon',
      'nesco center',
      'nesco goregaon',
    ],
  },
  'The Taj Mahal Palace': {
    lat: 18.9217,
    lng: 72.8332,
    aliases: ['taj mahal palace', 'taj colaba', 'taj hotel colaba', 'gateway taj'],
  },
  'Taj Lands End': {
    lat: 19.0435,
    lng: 72.8193,
    aliases: ['taj lands end', 'taj bandra', 'lands end bandra'],
  },
  'The St. Regis Mumbai': {
    lat: 18.9934,
    lng: 72.8251,
    aliases: ['st regis', 'st. regis', 'palladium hotel', 'st regis lower parel'],
  },
  'Grand Hyatt Mumbai': {
    lat: 19.0789,
    lng: 72.8534,
    aliases: ['grand hyatt', 'hyatt santacruz', 'hyatt kalina', 'grand hyatt mumbai'],
  },
  'JW Marriott Mumbai Juhu': {
    lat: 19.1009,
    lng: 72.8262,
    aliases: ['jw marriott juhu', 'marriott juhu', 'jw juhu'],
  },
  'JW Marriott Mumbai Sahar': {
    lat: 19.1002,
    lng: 72.8732,
    aliases: ['jw marriott sahar', 'marriott sahar', 'jw sahar'],
  },
  'The Leela Mumbai': {
    lat: 19.1118,
    lng: 72.8739,
    aliases: ['leela mumbai', 'the leela', 'leela andheri'],
  },
  'ITC Maratha': {
    lat: 19.1065,
    lng: 72.8694,
    aliases: ['itc maratha', 'maratha hotel'],
  },
  'ITC Grand Central': {
    lat: 18.9967,
    lng: 72.8402,
    aliases: ['itc grand central', 'itc parel'],
  },
  'CIDCO Exhibition Centre': {
    lat: 19.0631,
    lng: 72.9972,
    aliases: ['cidco exhibition', 'cidco vashi', 'cidco center'],
  },
  'Nehru Centre': {
    lat: 18.9897,
    lng: 72.8184,
    aliases: ['nehru centre', 'nehru planetarium', 'nehru science centre'],
  },
  'Dome, NSCI': {
    lat: 18.9837,
    lng: 72.8139,
    aliases: ['nsci dome', 'dome nsci', 'svp stadium', 'sardar vallabhbhai patel stadium'],
  },
  'World Trade Centre': {
    lat: 18.9137,
    lng: 72.8214,
    aliases: ['world trade centre', 'wtc mumbai', 'wtc cuffe parade'],
  },
  'Westin Mumbai Powai Lake': {
    lat: 19.1352,
    lng: 72.9087,
    aliases: ['westin powai', 'renaissance mumbai', 'westin powai lake'],
  },
  'The Westin Mumbai Garden City': {
    lat: 19.1729,
    lng: 72.8617,
    aliases: ['westin goregaon', 'westin garden city'],
  },
  'Sofitel Mumbai BKC': {
    lat: 19.0673,
    lng: 72.8661,
    aliases: ['sofitel bkc', 'sofitel mumbai'],
  },
  'Trident Bandra Kurla': {
    lat: 19.0678,
    lng: 72.8689,
    aliases: ['trident bkc', 'trident bandra kurla'],
  },
  'Trident Nariman Point': {
    lat: 18.9272,
    lng: 72.8206,
    aliases: ['trident nariman point', 'oberoi nariman point'],
  },
  'Four Seasons Hotel Mumbai': {
    lat: 18.995,
    lng: 72.8227,
    aliases: ['four seasons mumbai', 'four seasons worli'],
  },
  'Novotel Mumbai Juhu Beach': {
    lat: 19.0967,
    lng: 72.8248,
    aliases: ['novotel juhu', 'novotel mumbai'],
  },
  'Wankhede Stadium': {
    lat: 18.9389,
    lng: 72.8258,
    aliases: ['wankhede stadium', 'wankhede'],
  },
  'Brabourne Stadium': {
    lat: 18.9324,
    lng: 72.8254,
    aliases: ['brabourne stadium', 'cci brabourne'],
  },
  'MMRDA Grounds': {
    lat: 19.0632,
    lng: 72.8629,
    aliases: ['mmrda grounds', 'mmrda ground bkc', 'bkc ground'],
  },
};

/**
 * Searches curated Mumbai venues by name or address substring match
 */
export function lookupKnownMumbaiVenue(
  venueName: string,
  venueAddress: string = ''
): { name: string; coordinates: Coordinates } | null {
  const query = `${venueName} ${venueAddress}`.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');

  for (const [name, venue] of Object.entries(KNOWN_MUMBAI_VENUES)) {
    const cleanName = name.toLowerCase();
    if (query.includes(cleanName)) {
      return { name, coordinates: { lat: venue.lat, lng: venue.lng } };
    }
    for (const alias of venue.aliases) {
      if (query.includes(alias)) {
        return { name, coordinates: { lat: venue.lat, lng: venue.lng } };
      }
    }
  }

  return null;
}

/**
 * Resolves street-level coordinates for event venues in Mumbai.
 * Priority:
 * 1. Curated Known Venues dictionary (zero latency, deterministic pinpoints)
 * 2. Nominatim OpenStreetMap API query within Mumbai bounding box (if network available)
 * 3. Mumbai Zone Centroid fallback
 */
export async function resolveMumbaiVenueCoordinates(
  venueName: string,
  venueAddress: string,
  zone: string = 'Bandra Kurla Complex (BKC)'
): Promise<ResolvedVenueLocation> {
  // 1. Try Known Venue Match
  const known = lookupKnownMumbaiVenue(venueName, venueAddress);
  if (known) {
    return {
      coordinates: known.coordinates,
      source: 'known_venue',
      matchedName: known.name,
    };
  }

  // 2. Try Nominatim Geocoder with 2.5s timeout
  try {
    const cleanAddress = `${venueName}, ${venueAddress}, Mumbai, Maharashtra, India`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      cleanAddress
    )}&format=json&limit=1&countrycodes=in`;

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpsklEventApp/1.0 (ops@opskil.com)',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        // Ensure within Greater Mumbai / MMR region bounds (18.8 - 19.4 N, 72.7 - 73.2 E)
        if (lat >= 18.8 && lat <= 19.4 && lng >= 72.7 && lng <= 73.2) {
          return {
            coordinates: { lat, lng },
            source: 'nominatim',
            matchedName: item.display_name,
          };
        }
      }
    }
  } catch {
    // Timeout or network offline; proceed to fallback
  }

  // 3. Fallback to Zone Centroid
  const fallbackCoords =
    MUMBAI_ZONE_CENTROIDS[zone] || { lat: 19.066, lng: 72.868 };

  return {
    coordinates: fallbackCoords,
    source: 'zone_centroid',
  };
}
