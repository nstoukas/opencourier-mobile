import { NavigationProp, RouteProp } from '@react-navigation/native';

// The screens a logged out rider sees (row 17, spec 0039). There is no
// instance step: the app only ever talks to the co-op's server.
export enum AuthScreen {
  Login = 'Login',
  ForgotPassword = 'ForgotPassword',
  EnterCode = 'EnterCode',
}

export type AuthStackParamList = {
  Login: undefined;
  // The email typed on Login, so the rider does not type it twice.
  ForgotPassword: { email: string };
  // The email the code was sent for: shown on the screen and sent with the code.
  EnterCode: { email: string };
};

export type AuthNavigationProp = NavigationProp<AuthStackParamList>;
export type AuthScreenProp<T extends AuthScreen> = {
  navigation: AuthNavigationProp;
  route: RouteProp<AuthStackParamList, T>;
};
