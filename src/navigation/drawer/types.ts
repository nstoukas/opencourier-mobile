import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
// Renamed on import because this file exports its own DrawerNavigationProp below.
import { DrawerNavigationProp as LibraryDrawerNavigationProp } from '@react-navigation/drawer';
import { MainNavigationProp } from '../main/types';

export enum DrawerScreens {
  Home = 'Home',
  Earnings = 'Earnings',
  // Spec 0027: booking shifts, shown only while the co-op runs them.
  Shifts = 'Shifts',
  // Spec 0052: complaints the rider filed and the ones about them, with the reply box.
  Complaints = 'Complaints',
  PaymentMethods = 'PaymentMethods',
  Settings = 'Settings',
}

export type DrawerStackParamList = {
  Home: undefined;
  Earnings: undefined;
  Shifts: undefined;
  Complaints: undefined;
  PaymentMethods: undefined;
  Settings: undefined;
};

/**
 * The drawer sits inside the main stack, so a drawer screen can navigate to either.
 * CompositeNavigationProp unions the two, which is what lets Earnings push the stack
 * screens EarningsDelivery / PayoutActivity without TypeScript rejecting the route name.
 */
export type DrawerNavigationProp = CompositeNavigationProp<
  // The drawer library's own prop type adds openDrawer, closeDrawer and toggleDrawer,
  // which the plain NavigationProp does not know about.
  LibraryDrawerNavigationProp<DrawerStackParamList>,
  MainNavigationProp
>;
export type DrawerRouteProp<T extends DrawerScreens> = RouteProp<
  DrawerStackParamList,
  T
>;
export type DrawerScreenProp<T extends DrawerScreens> = {
  navigation: DrawerNavigationProp;
  route: DrawerRouteProp<T>;
};
