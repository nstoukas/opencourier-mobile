import {
  CompositeNavigationProp,
  NavigationProp,
  RouteProp,
} from '@react-navigation/native';
import { MainNavigationProp } from '../main/types';

export enum DrawerScreens {
  Home = 'Home',
  Earnings = 'Earnings',
  PaymentMethods = 'PaymentMethods',
  Settings = 'Settings',
}

export type DrawerStackParamList = {
  Home: undefined;
  Earnings: undefined;
  PaymentMethods: undefined;
  Settings: undefined;
};

/**
 * The drawer sits inside the main stack, so a drawer screen can navigate to either.
 * CompositeNavigationProp unions the two, which is what lets Earnings push the stack
 * screens EarningsDay / PayoutActivity without TypeScript rejecting the route name.
 */
export type DrawerNavigationProp = CompositeNavigationProp<
  NavigationProp<DrawerStackParamList>,
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
