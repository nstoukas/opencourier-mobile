import {
  CuisineType,
  EarningMethod,
  Language,
  MapLinkingOptions,
  OrderPreference,
  RestauranType,
  Ringtone,
  Theme,
  Vehicle,
  WeightOrder,
} from '@app/types/types';
import { Dimensions } from 'react-native';

export const SCREEN_HEIGHT = Dimensions.get('window').height;
export const SCREEN_WIDTH = Dimensions.get('window').width;
export const SCREEN_HORIZONTAL_MARGIN = 32;

export const isSmallDevice = SCREEN_WIDTH < 330;

// Offer timing on the phone (spec 0002). The deadline itself always comes
// from the server; these only say when the phone looks again or alerts again.
//
// The server ends an expired offer 3 s after its deadline (a network
// allowance). The phone fetches the list once, 1 s after that, in case the
// socket message saying the offer ended was missed. It sends nothing.
export const OFFER_END_CHECK_DELAY_MS = 4000;
// With Offer expiry off, a waiting offer alerts again this often (AC-4)...
export const OFFER_REMINDER_EVERY_MS = 30000;
// ...and vibrates longer once it has waited this long (AC-4).
export const OFFER_REMINDER_LONGER_AFTER_MS = 120000;
// Logging out sets the rider Offline first, but waits at most this long for
// the server, so a bad network never holds the rider at the logout button.
// Taking this phone off the rider's push list, just before, waits the same
// (row 58).
export const LOGOUT_OFFLINE_TIMEOUT_MS = 3000;
export const MAP_ACTION_SHEET_OPTIONS_IOS = [
  MapLinkingOptions.apple,
  MapLinkingOptions.google,
  MapLinkingOptions.waze,
  'Cancel',
];
export const MAP_ACTION_SHEET_OPTIONS_ANDROID = [
  MapLinkingOptions.google,
  MapLinkingOptions.waze,
  'Cancel',
];

export const ADD_NOTE_CELL = 'const_add_note_cell';

export const CELL_EARNINGS_EMPTY = 'const_earnings_empty';

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    id: '1',
    name: 'english_GB',
    abreviation: 'en-GB',
  },
  {
    id: '2',
    name: 'english_US',
    abreviation: 'en-US',
  },
  {
    id: '3',
    name: 'spanish_ES',
    abreviation: 'es-ES',
  },
  {
    id: '4',
    name: 'spanish_MX',
    abreviation: 'es-MX',
  },
  {
    id: '5',
    name: 'spanish_US',
    abreviation: 'es-US',
  },
];

export const SUPPORTED_THEMES: Theme[] = [
  { id: '1', name: 'dark' },
  { id: '2', name: 'light' },
];

export const SUPPORTED_RINGTONES: Ringtone[] = [
  {
    id: '1',
    name: 'bells',
  },
  {
    id: '2',
    name: 'chime',
  },
  {
    id: '3',
    name: 'dell',
  },
  {
    id: '4',
    name: 'ping',
  },
  {
    id: '5',
    name: 'open',
  },
];

export const SUPPORTED_VOLUMES: Ringtone[] = [
  {
    id: '1',
    name: 'softer',
  },
  {
    id: '2',
    name: 'normal',
  },
  {
    id: '3',
    name: 'louder',
  },
];

export const SUPPORTED_VEHICLES: Vehicle[] = [
  {
    id: '1',
    name: 'bicycle',
  },
  {
    id: '2',
    name: 'car',
  },
  {
    id: '3',
    name: 'motorcycle',
  },
  {
    id: '4',
    name: 'on_foot',
  },
  {
    id: '5',
    name: 'scooter',
  },
];

export const SUPPORTED_RESTAURANTS: RestauranType[] = [
  {
    id: '1',
    name: 'local',
  },
  {
    id: '2',
    name: 'black_owned',
  },
  {
    id: '3',
    name: 'women_owned',
  },
  {
    id: '4',
    name: 'franchise',
  },
  {
    id: '5',
    name: 'upscale',
  },
  {
    id: '6',
    name: 'fast_casual',
  },
  {
    id: '7',
    name: 'food_trucks',
  },
  {
    id: '8',
    name: 'vegan_vegetarian',
  },
];

export const SUPPORTED_CUISINES: CuisineType[] = [
  {
    id: '1',
    name: 'american',
  },
  {
    id: '2',
    name: 'italian',
  },
  {
    id: '3',
    name: 'mexian',
  },
  {
    id: '4',
    name: 'chinese',
  },
  {
    id: '5',
    name: 'japanese',
  },
  {
    id: '6',
    name: 'indian',
  },
  {
    id: '7',
    name: 'mediterranean',
  },
  {
    id: '8',
    name: 'thai',
  },
  {
    id: '9',
    name: 'french',
  },
  {
    id: '10',
    name: 'korean',
  },
  {
    id: '11',
    name: 'vietnamese',
  },
  {
    id: '12',
    name: 'middle_eastern',
  },
  {
    id: '13',
    name: 'african',
  },
  {
    id: '14',
    name: 'caribbean',
  },
];

export const SUPPORTED_EARNING_METHODS: EarningMethod[] = [
  {
    id: '1',
    name: 'per_delivery_rate',
  },
  {
    id: '2',
    name: 'distance_based_rate',
  },
  {
    id: '3',
    name: 'surge_pricing',
  },
  {
    id: '4',
    name: 'min_earnings_guarantee',
  },
];

export const SUPPORTED_ORDER_PREFERENCES: OrderPreference[] = [
  {
    id: '1',
    name: 'hot',
  },
  {
    id: '2',
    name: 'cold',
  },
  {
    id: '3',
    name: 'fragile',
  },
];

export const SUPPORTED_WEIGHT_ORDERS: WeightOrder[] = [
  {
    id: '1',
    name: 'small',
    info: 'weight_info_small',
  },
  {
    id: '2',
    name: 'medium',
    info: 'weight_info_medium',
  },
  {
    id: '3',
    name: 'large',
    info: 'weight_info_large',
  },
];
