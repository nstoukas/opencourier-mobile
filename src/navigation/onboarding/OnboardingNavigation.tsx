import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen, OnboardingStackParamList } from './types';
import { LandingScreen } from '@app/screens/onboarding/Landing/Landing';
import { WelcomeScreen } from '@app/screens/onboarding/Welcome/Welcome';
import { ChooseInstanceScreen } from '@app/screens/onboarding/ChooseInstance/ChooseInstance';
import { InstanceDetails } from '@app/screens/onboarding/InstanceDetails/InstanceDetails';
import { LoginInstance } from '@app/screens/onboarding/LoginInstance/LoginInstance';

const OnboardingStackNavigator =
  createNativeStackNavigator<OnboardingStackParamList>();

const DEFAULT_OPTIONS = { headerShown: false };

export const OnboardingStack = () => {
  return (
    <OnboardingStackNavigator.Navigator>
      <OnboardingStackNavigator.Screen
        name={OnboardingScreen.Landing}
        component={LandingScreen}
        options={DEFAULT_OPTIONS}
      />
      <OnboardingStackNavigator.Screen
        name={OnboardingScreen.Welcome}
        component={WelcomeScreen}
        options={DEFAULT_OPTIONS}
      />
      <OnboardingStackNavigator.Screen
        name={OnboardingScreen.ChooseInstance}
        component={ChooseInstanceScreen}
        options={DEFAULT_OPTIONS}
      />
      <OnboardingStackNavigator.Screen
        name={OnboardingScreen.InstanceDetails}
        component={InstanceDetails}
        options={DEFAULT_OPTIONS}
      />
      <OnboardingStackNavigator.Screen
        name={OnboardingScreen.LoginInstance}
        component={LoginInstance}
        options={DEFAULT_OPTIONS}
      />
    </OnboardingStackNavigator.Navigator>
  );
};
