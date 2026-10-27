import { Order, OrderItem } from '@app/types/types';
import {
  CompositeNavigationProp,
  NavigationProp,
  RouteProp,
} from '@react-navigation/native';
// `import type` brings in only the type, so no runtime import cycle with ../types.
import type { RootStackParamList } from '../types';

export enum MainScreens {
  Drawer = 'Drawer',
  ItemsCollected = 'ItemsCollected',
  MarkAsDelivered = 'MarkAsDelivered',
  PayoutActivity = 'PayoutActivity',
  Licences = 'Licences',
  LanguageScreen = 'LanguageScreen',
  OperatingArea = 'operatingArea',
  DefaultSound = 'DefaultSound',
  VolumeScreen = 'VolumeScreen',
  EmergencyContact = 'EmergencyContact',
  NavigationScreen = 'NavigationScreen',
  VehicleTypeScreen = 'VehicleTypeScreen',
  ShiftAvailabilityScreen = 'ShiftAvailabilityScreen',
  ReportIssue = 'ReportIssue',
  EarningsDay = 'EarningsDay',
  EarningsDelivery = 'EarningsDelivery',
}

export type MainStackParamList = {
  Drawer: undefined;
  ItemsCollected: {
    customerName: string;
    items: OrderItem[];
  };
  MarkAsDelivered: {
    order: Order;
  };
  PayoutActivity: undefined;
  Licences: undefined;
  LanguageScreen: undefined;
  // The key must equal the route name, which is the enum's value 'operatingArea' (lower case o).
  operatingArea: undefined;
  DefaultSound: undefined;
  VolumeScreen: undefined;
  EmergencyContact: undefined;
  NavigationScreen: undefined;
  VehicleTypeScreen: undefined;
  ShiftAvailabilityScreen: undefined;
  ReportIssue: {
    order: Order;
  };
  // Only the day is passed; the screen re-fetches so the list always matches the ledger.
  EarningsDay: {
    date: string; // 'YYYY-MM-DD'
  };
  EarningsDelivery: {
    deliveryId: string;
  };
};

/**
 * The main stack sits inside the root stack, so a main screen can also open the root's
 * modals (AddNoteModal, SelectOrganizationModal). The composite type lets TypeScript
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
