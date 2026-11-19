import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthScreen, AuthStackParamList } from './types';
import { Login } from '@app/screens/auth/Login/Login';
import { ForgotPassword } from '@app/screens/auth/ForgotPassword/ForgotPassword';
import { EnterCode } from '@app/screens/auth/EnterCode/EnterCode';

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Logged out: the co-op's login first (row 17, spec 0039, AC-1), then the
// password reset by email (AC-6, AC-10).
export const AuthStack = () => (
  <Stack.Navigator
    initialRouteName={AuthScreen.Login}
    screenOptions={{ headerShown: false }}>
    <Stack.Screen name={AuthScreen.Login} component={Login} />
    <Stack.Screen name={AuthScreen.ForgotPassword} component={ForgotPassword} />
    <Stack.Screen name={AuthScreen.EnterCode} component={EnterCode} />
  </Stack.Navigator>
);
