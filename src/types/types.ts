import type { BoxSize } from '@app/utilities/boxSize';
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

export enum SideMenuItem {
  Location = 'real_time_location',
  AutoOrders = 'auto_accept_orders',
  Orders = 'orders',
  // Spec 0034: the chat with dispatch, with no delivery tag.
  Chat = 'chat',
  Earnings = 'earnings',
  // Spec 0027: booking shifts, only while the co-op runs them.
  Shifts = 'shifts',
  // Spec 0052: complaints both ways.
  Complaints = 'complaints',
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

export enum PaymentTabItem {
  Bank = 'bank',
  DirectDebit = 'direct_debit',
}

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

// Spec 0053 (AC-3): a note about a place, as the job card gets it: never its author. `mine`
// only says the rider may edit or delete it; `upvotes` counts other riders' upvotes.
export type Note = {
  id: string;
  note: string;
  upvotes: number;
  upvotedByMe: boolean;
  flaggedByMe: boolean;
  mine: boolean;
};

// Which stop of the job a note is about (spec 0053, cross check 3).
export type NoteStop = 'PICKUP' | 'DROPOFF';

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
  // Spec 0033, while the rider waits at the restaurant: when they arrived,
  // when they may leave, and when the wait starts earning (null if it will
  // not). Each is sent on the server's clock and moved onto this phone's clock.
  arrivedAt?: string | null;
  arrivedAtOnPhone?: number | null;
  leaveFrom?: string | null;
  leaveFromOnPhone?: number | null;
  paidFrom?: string | null;
  paidFromOnPhone?: number | null;
  // Spec 0023: the restaurant's ready promise and when it marked the food ready, as ISO text on the
  // server's clock (null on orders made before ready times existed).
  readyAt?: string | null;
  foodReadyAt?: string | null;
  // `readyAt` moved onto this phone's clock when the job list arrived. Not sent by the server.
  readyAtOnPhone?: number | null;
  // Spec 0043: the order's box size, worded on the offer and the job card.
  boxSize?: BoxSize | null;
  // Spec 0046: "leg 1 of 2" of an order sent as several deliveries, worded
  // on the offer and the job card. Both null for a single delivery.
  legNumber?: number | null;
  legCount?: number | null;
  // Spec 0048 (row 80): two offers with the same id are one stack, two orders
  // offered together and answered together. null for a single offer.
  offerGroupId?: string | null;
  // Spec 0048: the stack's four stops in riding order (numbered 1 to 4), the
  // same list on both orders; null for a single order, and once the other
  // order of the pair is no longer this rider's.
  stackStops?: StackStop[] | null;
  // Spec 0035: this rider's newest removal request on this job, while it is open or was refused.
  // Null otherwise. Only the job list (deliveries/in-progress) sends it.
  removalRequest?: RemovalRequest | null;
  // Spec 0047: this rider's newest split request on the job, while open, refused or confirmed.
  splitRequest?: SplitRequest | null;
  // The request's flag and leave times, moved onto the phone's clock when the job list arrived.
  splitCreatedAtOnPhone?: number | null;
  splitLeaveFromOnPhone?: number | null;
};

export type SplitBoxSize = 'SMALL' | 'MEDIUM' | 'LARGE';

// Spec 0047: a rider's request to split an order that does not fit one box (`splitRequest` on a job).
export type SplitRequest = {
  id: string;
  deliveryId: string;
  status: 'OPEN' | 'CONFIRMED' | 'REFUSED' | 'LEFT' | 'VOID';
  proposedLegs: { boxSize: SplitBoxSize }[];
  // The boxes dispatch confirmed; the rider keeps the first.
  finalLegs: { boxSize: SplitBoxSize }[] | null;
  createdAt: string;
  // When the rider may leave without an answer, on the server's clock.
  leaveFrom: string;
  // Dispatch's sentence with a refusal; null when they wrote none.
  adminNote: string | null;
};

// A reason a rider can give for asking to come off an order (`GET removal-reasons`, spec 0035).
export type RemovalReason = {
  id: string;
  label: string;
  // Whether this reason pays the rider. Riders never see whether it bills the restaurant.
  paid: boolean;
  needsNote: boolean;
};

// The rider's own removal request, as the server sends it (spec 0035).
export type RemovalRequest = {
  id: string;
  status: 'OPEN' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
  label: string;
  paid: boolean;
  // Dispatch's sentence on a refusal; null when they wrote none.
  decisionNote: string | null;
  createdAt: string;
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

export enum SettingsOptions {
  accountInformation = 'account_information',
  emergencyContact = 'emergency_contact',
  // Spec 0051 (row 108).
  changePassword = 'change_password',
  accountChanges = 'account_changes',
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

// Spec 0038: a rider asks a person to review a decision the app took about their work.
export type ReviewTopic = 'OFFER' | 'PAY' | 'OTHER';
export type ReviewRequestStatus = 'OPEN' | 'ANSWERED' | 'WITHDRAWN';

export type ReviewRequest = {
  id: string;
  topic: ReviewTopic;
  // The rider's own words.
  note: string;
  status: ReviewRequestStatus;
  createdAt: string;
  // When a person must have answered by. Fixed when the request was sent.
  dueAt: string;
  // Open and past dueAt, decided by the server.
  overdue: boolean;
  outcome: 'STANDS' | 'CHANGED' | null;
  answer: string | null;
  answeredAt: string | null;
  withdrawnAt: string | null;
  // The pay correction the answer added, in cents, or null.
  correctionCents: number | null;
  // The correction's currency (the delivery's), or null with no correction.
  correctionCurrency: string | null;
  // The delivery it is about; null for a general request.
  delivery: { id: string; pickupName: string; createdAt: string } | null;
};

// Spec 0052 (row 83): complaints both ways. A rider files about a restaurant or a customer; a restaurant
// or the co-op files about a rider, who replies before anyone decides. Never a count or score (value 5).
export type ComplaintAbout = 'RESTAURANT' | 'CUSTOMER' | 'RIDER';
export type ComplaintFiledBy = 'RIDER' | 'RESTAURANT' | 'ADMIN';
export type ComplaintStatus =
  | 'OPEN'
  | 'AWAITING_REPLY'
  | 'DECIDED'
  | 'WITHDRAWN';
export type ComplaintCategory =
  | 'LONG_WAIT'
  | 'FOOD_NOT_READY'
  | 'UNSAFE_PACKAGING'
  | 'RUDE_STAFF'
  | 'ABUSE_OR_THREAT'
  | 'UNSAFE_ADDRESS'
  | 'NOT_ANSWERING'
  | 'LATE'
  | 'RUDE'
  | 'FOOD_DAMAGED'
  | 'OTHER';

// One complaint as the backend's ComplaintCourierDto sends it. The filer is only a kind: an admin's name
// never reaches the phone (AC-4).
export type Complaint = {
  id: string;
  // FILED_BY_YOU: the rider wrote it. ABOUT_YOU: a restaurant or the co-op wrote it about the rider.
  role: 'FILED_BY_YOU' | 'ABOUT_YOU';
  delivery: { id: string; pickupName: string; createdAt: string };
  filedBy: ComplaintFiledBy;
  about: ComplaintAbout;
  category: ComplaintCategory;
  text: string;
  // Slice 2: the rider attached a photo to their own complaint (never true on one about them).
  hasPhoto: boolean;
  status: ComplaintStatus;
  createdAt: string;
  riderReply: string | null;
  repliedAt: string | null;
  // True when the co-op typed the reply from a phone call (the rider's account was deactivated).
  replyEnteredForRider: boolean;
  outcome: string | null;
  decidedAt: string | null;
  withdrawnReason: string | null;
  withdrawnAt: string | null;
};

/** One page of a list the backend pages. `nextPage` is null on the last page. */
export type PagedList<T> = {
  data: T[];
  pagination?: {
    currentPage: number;
    nextPage: number | null;
    totalItems: number;
  };
};

/** Spec 0052: one page of the rider's complaints. No total: the rider's answer never counts their
 * complaints (AC-8, row 83 review), so the app only knows whether an older page exists. */
export type ComplaintPage = {
  data: Complaint[];
  pagination: {
    currentPage: number;
    nextPage: number | null;
  };
};

/** Spec 0038: the "How offers and pay work" page, as sentences built from the settings in effect. */
export type HowItWorks = {
  offers: string[];
  pay: string[];
  personDecides: string[];
  appRecords: string[];
  // Spec 0040 (AC-13): how time worked is counted. Optional: a server before spec 0040 leaves it out.
  timeWorked?: string[];
  // Spec 0042 (AC-14): how the Earnings figures are counted. Optional for the same reason.
  earningsFigures?: string[];
  reviewAnswerDays: number;
};

/** Spec 0038: one line of "What changed". Never names a person. */
export type SettingChangeLine = {
  at: string;
  label: string;
  oldText: string;
  newText: string;
};

// Spec 0048: one stop of a stack, picking an order up or handing it over.
export type StackStop = {
  deliveryId: string;
  stop: 'PICKUP' | 'DROPOFF';
};
