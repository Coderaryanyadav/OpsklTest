/**
 * OPSKL CONSTANTS & INDIAN EVENT MARKET SPECIFICATIONS
 */

export const MUMBAI_EVENT_ZONES = [
  {
    id: 'bkc',
    name: 'Bandra Kurla Complex (BKC)',
    landmarkVenues: ['Jio World Convention Centre', 'MMRDA Grounds'],
  },
  {
    id: 'goregaon',
    name: 'Goregaon East',
    landmarkVenues: ['Bombay Exhibition Centre (NESCO)'],
  },
  {
    id: 'vashi',
    name: 'Navi Mumbai',
    landmarkVenues: ['CIDCO Exhibition Centre'],
  },
  {
    id: 'worli',
    name: 'Worli / Lower Parel',
    landmarkVenues: ['Nehru Centre', 'Dome SVP Stadium'],
  },
  {
    id: 'cuffe_parade',
    name: 'South Mumbai',
    landmarkVenues: ['World Trade Centre (WTC)'],
  },
  {
    id: 'andheri',
    name: 'Andheri West / East',
    landmarkVenues: ['The Lalit Intercontinental', 'Grand Hyatt Mumbai'],
  },
] as const;

export const EVENT_ROLES = [
  {
    id: 'registration_usher',
    name: 'Registration Desk & Usher',
    category: 'exhibition',
    defaultHourlyRate: 175, // ₹1,400 for 8h
    typicalDuties: [
      'Scan attendee QR tickets at entry turnstiles',
      'Distribute delegate badge lanyards and kit bags',
      'Direct VIP guests to designated hall tracks',
    ],
  },
  {
    id: 'booth_executive',
    name: 'Exhibition Booth Assistant',
    category: 'corporate',
    defaultHourlyRate: 200, // ₹1,600 for 8h
    typicalDuties: [
      'Greet visiting delegates and record visiting cards',
      'Demonstrate sample merchandise / promotional collateral',
      'Manage booth queue and beverage hospitality',
    ],
  },
  {
    id: 'crowd_management',
    name: 'Crowd & Queue Marshall',
    category: 'activation',
    defaultHourlyRate: 160, // ₹1,280 for 8h
    typicalDuties: [
      'Guide visitor movement across main exhibition halls',
      'Ensure clear passage around emergency exits and escalators',
      'Coordinate with venue security officers',
    ],
  },
  {
    id: 'backstage_logistics',
    name: 'Backstage Runner & Speaker Assistant',
    category: 'conference',
    defaultHourlyRate: 185, // ₹1,480 for 8h
    typicalDuties: [
      'Assist stage coordinator with presenter microphones',
      'Escort keynote speakers from green room to main podium',
      'Distribute speaker water bottles and presentation clickers',
    ],
  },
] as const;

export const OPSKL_APP_IDS = {
  worker: {
    ios: 'com.opskil.worker',
    android: 'com.opskil.worker',
    scheme: 'opskil-worker',
  },
  organizer: {
    ios: 'com.opskil.organizer',
    android: 'com.opskil.organizer',
    scheme: 'opskil-organizer',
  },
} as const;
