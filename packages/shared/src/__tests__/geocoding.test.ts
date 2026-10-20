import {
  resolveMumbaiVenueCoordinates,
  lookupKnownMumbaiVenue,
  MUMBAI_ZONE_CENTROIDS,
} from '../utils/geocoding';

describe('Mumbai Geocoding & Venue Resolution Engine', () => {
  it('correctly matches curated known venues by primary name', () => {
    const match = lookupKnownMumbaiVenue('Jio World Convention Centre', 'G Block BKC');
    expect(match).not.toBeNull();
    expect(match?.name).toBe('Jio World Convention Centre');
    expect(match?.coordinates.lat).toBeCloseTo(19.0645, 3);
    expect(match?.coordinates.lng).toBeCloseTo(72.8687, 3);
  });

  it('correctly matches known venues by alias (e.g. nesco, bec goregaon)', () => {
    const match1 = lookupKnownMumbaiVenue('NESCO Center Hall 1', 'Western Express Highway');
    expect(match1).not.toBeNull();
    expect(match1?.name).toBe('NESCO Exhibition Centre');

    const match2 = lookupKnownMumbaiVenue('Taj Lands End', 'Bandstand Bandra West');
    expect(match2).not.toBeNull();
    expect(match2?.name).toBe('Taj Lands End');
  });

  it('resolves pinpoint coordinates for Jio World Convention Centre', async () => {
    const res = await resolveMumbaiVenueCoordinates(
      'Jio World Convention Centre',
      'G Block, Bandra Kurla Complex',
      'Bandra Kurla Complex (BKC)'
    );
    expect(res.source).toBe('known_venue');
    expect(res.matchedName).toBe('Jio World Convention Centre');
    expect(res.coordinates.lat).toBeCloseTo(19.0645, 3);
    expect(res.coordinates.lng).toBeCloseTo(72.8687, 3);
  });

  it('falls back to zone centroid when venue is unknown and offline', async () => {
    // Unknown venue name
    const res = await resolveMumbaiVenueCoordinates(
      'Unknown Private Community Hall 9999',
      'Random Lane, Powai',
      'Powai & Central Mumbai'
    );
    expect(res.source).toBe('zone_centroid');
    expect(res.coordinates).toEqual(MUMBAI_ZONE_CENTROIDS['Powai & Central Mumbai']);
  });
});
