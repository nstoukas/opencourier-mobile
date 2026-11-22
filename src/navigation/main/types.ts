import { Order } from '@app/types/types';
import {
  CompositeNavigationProp,
  NavigationProp,
  RouteProp,
} from '@react-navigation/native';
// `import type` brings in only the type, so no runtime import cycle with ../types.
import type { RootStackParamList } from '../types';

export enum MainScreens {
  Drawer = 'Drawer',
  // Location and notifications, once after a login (row 17, spec 0039, AC-15).
  Permissions = 'Permissions',
  PayoutActivity = 'PayoutActivity',
  Licences = 'Licences',
  LanguageScreen = 'LanguageScreen',
  OperatingArea = 'operatingArea',
  DefaultSound = 'DefaultSound',
  VolumeScreen = 'VolumeScreen',
  EmergencyContact = 'EmergencyContact',
  // Spec 0051 (row 108).
  ChangePassword = 'ChangePassword',
  AccountChanges = 'AccountChanges',
  NavigationScreen = 'NavigationScreen',
  VehicleTypeScreen = 'VehicleTypeScreen',
  ShiftAvailabilityScreen = 'ShiftAvailabilityScreen',
  ReportIssue = 'ReportIssue',
  ReportProduct = 'ReportProduct',
  RequestRemoval = 'RequestRemoval',
  RequestSplit = 'RequestSplit',
  // The rider's chat with dispatch (spec 0034).
  Chat = 'Chat',
  EarningsDelivery = 'EarningsDelivery',
  // How offers and pay work, the rider's review requests and what changed (spec 0038).
  HowItWorks = 'HowItWorks',
  RequestReview = 'RequestReview',
  // Spec 0052: a complaint about the restaurant or the customer of one job, from Earnings.
  FileComplaint = 'FileComplaint',
}

export type MainStackParamList = {
  Drawer: undefined;
  Permissions: undefined;
  PayoutActivity: undefined;
  Licences: undefined;
  LanguageScreen: undefined;
  // The key must equal the route name, which is the enum's value 'operatingArea' (lower case o).
  operatingArea: undefined;
  DefaultSound: undefined;
  VolumeScreen: undefined;
  EmergencyContact: undefined;
  ChangePassword: undefined;
  AccountChanges: undefined;
  NavigationScreen: undefined;
  VehicleTypeScreen: undefined;
  ShiftAvailabilityScreen: undefined;
  ReportIssue: {
    order: Order;
  };
  ReportProduct: {
    order: Order;
  };
  RequestRemoval: {
    order: Order;
  };
  // Spec 0047: the order does not fit one box.
  RequestSplit: {
    order: Order;
  };
  // Opened from a job, its messages are tagged with that delivery; from the side menu, with none.
  Chat:
    | {
        deliveryId?: string;
        orderReference?: string | null;
      }
    | undefined;
  EarningsDelivery: {
    deliveryId: string;
  };
  HowItWorks: undefined;
  // From a delivery's pay breakdown: its id and a short label ("R101 Kitchen, 3 Nov 2026"). From the
  // explanation page: neither, for a general request.
  RequestReview:
    | {
        deliveryId?: string;
        deliveryLabel?: string;
      }
    | undefined;
  // From a delivery's pay breakdown: its id and the same short label as RequestReview.
  FileComplaint: {
    deliveryId: string;
    deliveryLabel: string;
  };
};

/**
 * The main stack sits inside the root stack, so a main screen can also open the root's
 * modals (AddNoteModal, UserStatusModal). The composite type lets TypeScript
 * accept both sets of route names; at runtime React Navigation already bubbles the call up.
 */
export type MainNavigationProp = CompositeNavigationProp<
  NavigationProp<MainStackParamList>,
  NavigationProp<RootStackParamList>
>;
export type MainRouteProp<T extends MainScreens> = RouteProp<
  MainStackParamList,
  T
>;
export type MainScreenProp<T extends MainScreens> = {
  navigation: MainNavigationProp;
  route: MainRouteProp<T>;
};
