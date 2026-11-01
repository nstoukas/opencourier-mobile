import { Instance } from '@app/types/types';
import { NavigationProp, RouteProp } from '@react-navigation/native';

export enum OnboardingScreen {
  Landing = 'Landing',
  Welcome = 'Welcome',
  ChooseInstance = 'ChooseInstance',
  Login = 'Login',
  InstanceDetails = 'InstanceDetails',
  LoginInstance = 'LoginInstance',
}

export type OnboardingStackParamList = {
  Landing: undefined;
  Welcome: undefined;
  ChooseInstance: {
    registryLink: string;
  };
  Login: undefined;
  InstanceDetails: {
    instanceLink: string;
    registryLink?: string;
  };
  LoginInstance: {
    instance: Instance;
  };
};

export type OnboardingNavigationProp = NavigationProp<OnboardingStackParamList>;
export type OnboardingRouteProp<T extends OnboardingScreen> = RouteProp<
  OnboardingStackParamList,
  T
>;
export type OnboardingScreenProp<T extends OnboardingScreen> = {
  navigation: OnboardingNavigationProp;
  route: OnboardingRouteProp<T>;
};
