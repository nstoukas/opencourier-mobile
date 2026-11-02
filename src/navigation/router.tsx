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
import { useArrivalDetection } from '@app/hooks/useArrivalDetection';
import { useSos } from '@app/hooks/useSos';
import { SosScreen } from '@app/screens/Sos/SosScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const DEFAULT_OPTIONS = { headerShown: false };

// Renders nothing: it only runs arrival detection (spec 0021).
const ArrivalDetector = ({ courierId }: { courierId: string | undefined }) => {
  useArrivalDetection(courierId);
  return null;
};

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

  // The rider's SOS (spec 0022): sends it, resumes it after a restart, and
  // says whether the phone shares its position for it right now.
  const sosSharing = useSos(user?.id);

  // The one location watch: only while Online, on a job (row 67), or during
  // the rider's own SOS (spec 0022), when it runs at SOS options.
  useLocationTracking(user, locationPermission, sosSharing);

  return (
    <>
      {/* Arrival at the restaurant and the customer, noticed from the
          location watch's fixes on the phone (spec 0021). Its own leaf, so
          each fix redraws only this, not the whole navigator (review nit). */}
      <ArrivalDetector courierId={user?.id} />
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
            {/* Full screen over everything; Android Back leaves it while the
                SOS stays active (spec 0022, AC-3). */}
            <RootStack.Screen
              name={RootScreen.Sos}
              component={SosScreen}
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </>
  );
};
