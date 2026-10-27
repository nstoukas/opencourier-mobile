import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootScreen, RootStackParamList } from '@app/navigation/types';
import { LoadingScreen } from '@app/screens/Loading/Loading';
import { OnboardingStack } from '@app/navigation/onboarding/OnboardingNavigation';
import { MainStack } from './main/MainNavigation';
import { SelectOrganizationModal } from '@app/screens/SelectOrganizationModal/SelectOrganizationModal';
import { StatusPopupScreen } from '@app/screens/StatusPopup/StatusPopupScreen';
import { useOfferPushRegistration } from '@app/services/offerPush/registration';
import { AddNote } from '@app/screens/AddNote/AddNote';
import { DeleteNote } from '@app/screens/DeleteNote/DeleteNote';
import { DatePickerScreen } from '@app/screens/DatePicker/DatePicker';
import {
  useGrantedLocationPermission,
  useLocationPermission,
} from '@app/hooks/useLocationPermission';
import useUser from '@app/hooks/useUser';
import { useLocationTracking } from '@app/hooks/useLocationTracking';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const DEFAULT_OPTIONS = { headerShown: false };

export const Router = () => {
  const { user } = useUser();
  const { locationPermission } = useLocationPermission();
  useGrantedLocationPermission();

  // Register this phone for offer alerts while a rider is logged in (row 58).
  useOfferPushRegistration(user?.id);
  // if (user.isLoading) {
  //   return <RootStack.Screen
  //     name={RootScreen.Loading}
  //     component={LoadingScreen}
  //     options={DEFAULT_OPTIONS}
  //   />
  // }

  // The one location watch: only while Online or on a job (row 67).
  useLocationTracking(user, locationPermission);

  return (
    <RootStack.Navigator>
      {!user ? (
        <>
          <RootStack.Screen
            name={RootScreen.Loading}
            component={LoadingScreen}
            options={DEFAULT_OPTIONS}
          />
          <RootStack.Screen
            name={RootScreen.Onboarding}
            component={OnboardingStack}
            options={DEFAULT_OPTIONS}
          />
        </>
      ) : (
        <>
          <RootStack.Screen
            name={RootScreen.Main}
            component={MainStack}
            options={DEFAULT_OPTIONS}
          />
          <RootStack.Screen
            name={RootScreen.SelectOrganizationModal}
            component={SelectOrganizationModal}
            options={{ headerShown: false, presentation: 'transparentModal' }}
          />
          <RootStack.Screen
            name={RootScreen.UserStatusModal}
            component={StatusPopupScreen}
            options={{ headerShown: false, presentation: 'transparentModal' }}
          />
          <RootStack.Screen
            name={RootScreen.AddNoteModal}
            component={AddNote}
            options={{ headerShown: false, presentation: 'transparentModal' }}
          />
          <RootStack.Screen
            name={RootScreen.DeleteNoteModal}
            component={DeleteNote}
            options={{ headerShown: false, presentation: 'transparentModal' }}
          />
          <RootStack.Screen
            name={RootScreen.DatePickerScreen}
            component={DatePickerScreen}
            options={{ headerShown: false, presentation: 'transparentModal' }}
          />
        </>
      )}
    </RootStack.Navigator>
  );
};
