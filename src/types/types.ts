import { OfferTrip } from '@app/utilities/offerTrip';
import { Point, Polygon } from 'geojson';
import moment, { Moment } from 'moment';
import {
  CuisineTypes,
  DeliverySpeed,
  DietaryRestrictions,
  FoodPreferences,
  OrderPreferences,
  OrderSetting,
  RestaurantTypes,
  VehicleType,
} from './enums';
import { Settings } from 'react-native';

export enum UserStatus {
  Online = 'ONLINE',
  Offline = 'OFFLINE',
  LastCall = 'LAST_CALL',
}

export enum InstanceTabItem {
  Description = 'description',
  Rules = 'rules',
}

// Only the History screen shows an empty list since spec 0018 (home is a map).
export enum HomeEmptyState {
  History = 'History',
}

export enum SideMenuItem {
  Location = 'real_time_location',
  AutoOrders = 'auto_accept_orders',
  Orders = 'orders',
  Earnings = 'earnings',
  // Spec 0018: the delivery history, moved off home.
  History = 'history',
  // Spec 0027: booking shifts, only while the co-op runs them.
  Shifts = 'shifts',
  Payout = 'payout_method',
  Support = 'support',
  Settings = 'settings',
  Logout = 'log_out',
}

export enum OrderStatus {
  created = 'created',
  dispatched = 'dispatched',
  picked_up = 'picked_up',
  dropped_off = 'dropped_off',
  canceled = 'canceled',
}

export enum DeliveryType {
  LeaveAtDoor = 'leave_at_door',
  MeetOutside = 'meet_outside',
  MeetInside = 'meet_inside',
  MeetAtDoor = 'meet_at_door',
  CallOnArrival = 'call_on_arrival',
}

export enum PickupType {
  LineupThirdPartyPickup = 'line_up_pickup',
  ParkThirdPartyLot = 'park_in_lot',
  DontOpenBags = 'dont_open_bags',
  CallOnArrival = 'call_on_arrival',
}

export enum MapLinkingOptions {
  apple = 'apple_maps',
  google = 'google_maps',
  waze = 'waze',
}

export enum CustomerNotes {
  PreventLeaks = 'prevent_leaks',
  BellnotRung = 'bell_not_rung',
  HandleWithCare = 'handle_with_care',
  DontBlockDoor = 'dont_block_door',
}

export enum EarningsTabItem {
  Today = 'today',
  Weekly = 'weekly',
  All = 'all',
}

/**
 * One day of the courier earnings report, as returned by
 * `GET /courier/earnings-summary`. The backend groups completed deliveries into days
 * using the timezone we ask for, so `date` is the courier's own day, not the server's.
 * Every money field is an **integer number of cents**.
 */
export type EarningsSummaryDay = {
  date: string; // 'YYYY-MM-DD' in the requested timezone
  deliveryCount: number;
  compensation: number; // piece-rate pay
  tips: number;
  total: number; // compensation + tips
};

/**
 * One completed delivery inside a day's earnings, from
 * `GET /courier/earnings/day`. Money is in integer cents.
 */
export type EarningsDelivery = {
  deliveryId: string;
  droppedOffAt: string; // ISO timestamp
  dropoffAddress: string | null;
  pickupBusinessName: string;
  compensation: number; // piece-rate pay
  tips: number;
  total: number;
  // A pay that is not a drop off: a reassigned rider's payout, or a cancelled job's (spec 0015).
  kind?: 'REASSIGNMENT_COMPENSATION' | 'CANCELLATION_COMPENSATION';
};

/**
 * The deliveries that made up one day's earnings. The totals are summed by the backend
 * from the same ledger the per-day summary uses, so this list always reconciles with the
 * day row it was opened from.
 */
export type EarningsDay = {
  date: string; // 'YYYY-MM-DD'
  timezone: string;
  currency: string;
  deliveryCount: number;
  compensation: number;
  tips: number;
  total: number;
  deliveries: EarningsDelivery[];
};

/** One delivery's full breakdown, from `GET /courier/earnings/delivery/:deliveryId`. */
export type EarningsDeliveryDetail = EarningsDelivery & {
  currency: string;
};

/** The whole earnings report for one window. Totals are summed by the backend. */
export type EarningsSummary = {
  from: string;
  to: string;
  timezone: string;
  currency: string; // instance currency, voted on in Config — never assume USD
  totalDeliveryCount: number;
  totalCompensation: number;
  totalTips: number;
  totalEarnings: number;
  days: EarningsSummaryDay[];
};

export enum PaymentTabItem {
  Bank = 'bank',
  DirectDebit = 'direct_debit',
}

export type Organization = {
  name: string;
  id: string;
  imageUrl: string;
};

export type Courier = {
  id: string;
  node_uri: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  status: UserStatus;
  deliverySetting: string;
  userId: string;
  createdAt: string;
  currentLocation: {
    latitude: number;
    longitude: number;
  };
};

export type UserResponse = {
  error: boolean;
  result: {
    id: string;
    email: string;
    role: string[];
    courier: Courier;
  };
};

export type User = {
  email: string;
  role: string[];
} & Courier;

export type Setting = {
  deliveryPolygon?: Polygon | null;
  vehicleType?: VehicleType | null;
  preferredAreas?: string[] | null;
  shiftAvailability?: ShiftAvailability | null;
  orderPreferences?: OrderPreferences[] | null;
  foodPreferences?: FoodPreferences[] | null;
  earningGoals?: EarningGoals | null;
  deliverySpeed?: DeliverySpeed | null;
  restaurantTypes?: RestaurantTypes[] | null;
  cuisineTypes?: CuisineTypes[] | null;
  preferredRestaurantPartners?: string[] | null;
  dietaryRestrictions?: DietaryRestrictions[] | null;
  payRate?: PayRate | null;
};

export type Restaurant = {
  name: string;
  address: string;
  location?: { lat: number; lon: number };
};

export type Comment = {
  id: string;
  text: string;
  likes: number;
  likers: string[];
  commentableType: 'merchant' | 'location';
  commentableId: string;
  commentor: string;
};

export type Verification = {
  signature: boolean;
  signatureRequirement: {
    enabled: boolean;
    collectSignerName: boolean;
    collectSignerRelationship: boolean;
  };
  barcodes: {
    value: string;
    type: string;
  }[];
  identification: {
    minAge: number;
    noSobrietyCheck: boolean;
  };
  picture: boolean;
};

export type Note = {
  id: string;
  note: string;
  courierId: string;
  actor: string;
  locationId: string;
  deliveryId: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  currentCourierReaction: string;
};

export type OrderItem = {
  name: string;
  quantity: number;
  size: string;
  dimensions: {
    length: string;
    height: string;
    depth: string;
  };
  price: number;
  weight: number;
  vatPercentage: number;
  // Spec 0028: a drink or a side, marked by the restaurant; absent means neither.
  kind?: 'DRINK' | 'SIDE';
};

export type Order = {
  id: string;
  pickupName: string;
  pickupPhoneNumber: string;
  pickupBusinessName: string;
  pickupNotes: string;
  pickupVerification: Verification;
  pickupLocationId: string;
  pickupReadyAt: string;
  pickupDeadlineAt: string;
  dropoffName: string;
  // Only while this rider holds the delivery (row 33): left out in an offer and after the end.
  dropoffPhoneNumber?: string;
  dropoffBusinessName: string;
  dropoffNotes: string;
  dropoffSellerNotes: string;
  // Spec 0016: the floor and the name on the doorbell. Like the phone, only while this rider holds
  // the delivery (row 33): left out in an offer and after the end.
  dropoffFloor?: string | null;
  dropoffDoorbell?: string | null;
  // Spec 0016: set once the rider moved the drop off pin (at most once per delivery).
  dropoffPointCorrectedAt?: string | null;
  dropoffVerification: Verification;
  dropoffReadyAt: string;
  dropoffEta: string;
  dropoffDeadlineAt: string;
  deliverableAction: string;
  undeliverableAction: string;
  undeliverableReason?: string;
  dropoffLocationId: string;
  deliveryTypes: string[];
  requiresDropoffSignature: string;
  requiresId: boolean;
  orderReference: string;
  orderTotalValue: number;
  orderItems: OrderItem[];
  status: string;
  // Set by the app, never by the server: a step of this delivery waits in the
  // outbox for signal, and `status` above already shows it (spec 0009).
  waitingToSend?: boolean;
  customerNotes: string[];
  currencyCode: string;
  totalCost: number;
  fee: number;
  pay?: any;
  tips?: number;
  totalCompensation: number;
  pickupTypes: string[];
  imageType?: any;
  imageName?: any;
  imageDate?: any;
  idempotencyKey: string;
  externalStoreId: string;
  returnVerification: Verification;
  externalUserInfo?: any;
  externalId: string;
  courierId: string;
  partnerId: string;
  deliveryQuoteId: string;
  createdAt: string;
  pickupLocationNotes: Note[];
  dropOffLocationNotes: Note[];
  pickupLocationFormattedAddress?: string;
  dropoffLocationFormattedAddress?: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  // When the server made this offer, and when it ends (spec 0002), as ISO
  // date text on the server's clock. `offerExpiresAt` null means the offer has
  // no deadline (Offer expiry is off, or an admin made the offer). Only the
  // offer list (deliveries/new) sends these.
  offeredAt?: string | null;
  offerExpiresAt?: string | null;
  // The two times above moved onto this phone's clock, worked out once when
  // the offer list arrives (see `utilities/offerClock.ts`). Not sent by the
  // server.
  phoneClock?: OfferTimesOnPhone;
  // Spec 0019: the ride the offer means, worked out by the backend from the
  // co-op's routing; null figures are unknown. Offers only.
  offerTrip?: OfferTrip;
  // Spec 0019: the drop off street, or the city when the street would give
  // the house away (the same as the offer push). Offers only.
  dropoffArea?: string;
  // Spec 0020: the end of the free hand back, as ISO date text on the server's
  // clock; set only while it is ahead and the rider has not reached the
  // restaurant. The job list (deliveries/in-progress) sends it.
  handBackUntil?: string | null;
  // The time above moved onto this phone's clock (see
  // `utilities/handBackWindow.ts`). Not sent by the server. It is saved with
  // the job list (queryPersistence), which is harmless: home refetches on
  // focus and the server decides every hand back.
  handBackUntilOnPhone?: number | null;
};

// An offer's times in milliseconds on the phone's own clock (like Date.now()).
export type OfferTimesOnPhone = {
  offeredAt: number | null;
  expiresAt: number | null;
};

export type PickupruInstruction = {
  type: string;
  count?: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type CoordinatesRange = {
  latitude_range: number[];
  longitude_range: number[];
};

export type Location = {
  id: string;
  addressLine1: string;
  addressLine2: string;
  street?: string;
  houseNumber?: string;
  state?: string;
  city?: string;
  postCode?: string;
  stateCode?: string;
  countryCode?: string;
  longitude: number;
  latitude: number;
  formattedAddress: string;
};

export type CourierTip = {
  courier_id: string;
  tip_text: string;
  upvotes: number;
};

// export type Dimensions = {
//   length: number;
//   width: number;
//   height: number;
//   unit: string;
// };

export type Income = {
  currencyCode: string;
  totalCharge: number;
  fees: number;
  totalCompensation: number;
  pay: number;
  tips: number;
};

export type Pagination = {
  total: number;
  lastPage: number;
  currentPage: number;
  perPage: number;
  prevPage: number;
  nextPage: number;
};

export type ConfirmItemsCheck = {
  orderId: string;
  confirmedItems: boolean;
};

export type Instance = {
  registry?: any;
  details: any;
  config: any;
  updatedAt: any;
};

export enum SettingsOptions {
  accountInformation = 'account_information',
  emergencyContact = 'emergency_contact',
  language = 'language',
  navigation = 'navigation',
  operatingArea = 'specify_operating',
  verification = 'verification',
  notifications = 'notifications',
  cashOnDelivery = 'cash_on_delivery',
  licenses = 'licenses',
  vehicleType = 'vehicle_type',
  shiftAvailability = 'shift_availability',
}

export type Language = {
  id: string;
  name: string;
  abreviation: string;
};

export type Theme = {
  id: string;
  name: string;
};

export enum AccessibilitySettingsOptions {
  volume = 'default_volume',
  sound = 'default_sound',
  myLanguages = 'my_languages',
  differentSounds = 'enable_different_sounds',
  screenFlash = 'screen_flash',
  vibration = 'enable_vibration',
  readingNotes = 'reading_notes',
  seatbeltReminder = 'seatbelt_reminder',
  deaf = 'im_deaf',
}

export type Ringtone = {
  id: string;
  name: string;
};

export type Volume = {
  id: string;
  name: string;
};

export enum ToastMessage {
  enableNotifications = 'enable_notifications',
  itemsBagged = 'items_bagged',
  enableLocationServices = 'enable_location_services',
  pickupBeforeContinuing = 'pickup_before_continue',
  waitingForNewOrders = 'waiting_for_orders',
  addressCopied = 'address_copied',
  get_closer = 'get_closer_to_restaurant',
  item_may_be_bagged = 'item_may_be_bagged',
}

export type Vehicle = {
  id: string;
  name: string;
};

export type RestauranType = {
  id: string;
  name: string;
};

export type CuisineType = {
  id: string;
  name: string;
};

export type EarningMethod = {
  id: string;
  name: string;
};

export type OrderPreference = {
  id: string;
  name: string;
};

export type WeightOrder = {
  id: string;
  name: string;
  info: string;
};

export type ShiftRange = {
  start: Date;
  end: Date;
};

export type Shift = {
  day: string;
  shiftRanges: ShiftRange[];
};

export type ShiftAvailability = {
  sunday: Date[][];
  monday: Date[][];
  tuesday: Date[][];
  wednesday: Date[][];
  thursday: Date[][];
  friday: Date[][];
  saturday: Date[][];
};

export type EarningGoals = {
  daily: number;
  weekly: number;
};

export type PayRate = {
  hourlyRate: number;
  perDeliveryRate: number;
  // Per mile
  distanceBasedRate: number;
  surgePricingPreference: number;
  minimumEarningsGuarantee: number;
};

export type Item = {
  name: string;
  quantity?: number;
  size?: 'small' | 'medium' | 'large';
  price?: number;
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
  keepUpright?: boolean;
};

// export type OrderItem = {
//   name: string;
//   quantity: number;
//   size: string;
//   dimensions: Dimensions;
//   price: number;
//   must_be_upright: boolean;
//   weight: number;
// };

// export enum OrderState {
//   orderPickup,
//   confirmingOrderItems,
//   orderDeliveryInProgress,
//   deliveryDone,
// }
