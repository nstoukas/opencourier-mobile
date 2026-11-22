import React, { useState } from 'react';
import { MainScreens, MainStackParamList } from './types';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerStack } from '../drawer/DrawerNavigation';
import { PayoutActivity } from '@app/screens/PayoutActivity/PayoutActivity';
import { LicencesScreen } from '@app/screens/Licences/Licences';
import { LanguageScreen } from '@app/screens/SettingsStack/Language/Language';
import { EmergencyContact } from '@app/screens/SettingsStack/EmergencyContact/EmergencyContact';
import { ChangePassword } from '@app/screens/SettingsStack/ChangePassword/ChangePassword';
import { AccountChanges } from '@app/screens/SettingsStack/AccountChanges/AccountChanges';
import { NavigationScreen } from '@app/screens/SettingsStack/Navigation/Navigation';
import { OfferSound } from '@app/screens/SettingsStack/OfferSound/OfferSound';
import { RingCheck } from '@app/screens/SettingsStack/RingCheck/RingCheck';
import { Account } from '@app/screens/Account/Account';
import { EarningsDelivery } from '@app/screens/EarningsDelivery/EarningsDelivery';
import { ReportIssue } from '@app/screens/ReportIssue/ReportIssue';
import { ReportProduct } from '@app/screens/ReportProduct/ReportProduct';
import { RequestRemoval } from '@app/screens/RequestRemoval/RequestRemoval';
import { RequestSplit } from '@app/screens/RequestSplit/RequestSplit';
import { Chat } from '@app/screens/Chat/Chat';
import { HowItWorks } from '@app/screens/HowItWorks/HowItWorks';
import { RequestReview } from '@app/screens/RequestReview/RequestReview';
import { FileComplaint } from '@app/screens/FileComplaint/FileComplaint';
import { Permissions } from '@app/screens/Permissions/Permissions';
import { takeJustLoggedIn } from '@app/services/afterLogin';

// The <MainStackParamList> type argument tells the navigator which routes exist and what
// params each takes, so every screen's Props is checked against its own route.
const MainStackNavigator = createNativeStackNavigator<MainStackParamList>();

const DEFAULT_OPTIONS = { headerShown: false };

export const MainStack = () => {
  // Right after a login or a reset, Permissions comes first; it goes straight on
  // to Home when nothing is missing. Never on a restart while logged in (AC-15).
  // `useState(() => ...)` reads the one time flag once, when the stack appears.
  const [firstRoute] = useState(() =>
    takeJustLoggedIn() ? MainScreens.Permissions : MainScreens.Drawer,
  );
  return (
    <MainStackNavigator.Navigator initialRouteName={firstRoute}>
      <MainStackNavigator.Screen
        name={MainScreens.Drawer}
        component={DrawerStack}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.Permissions}
        component={Permissions}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.PayoutActivity}
        component={PayoutActivity}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.Licences}
        component={LicencesScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.LanguageScreen}
        component={LanguageScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.EmergencyContact}
        component={EmergencyContact}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.ChangePassword}
        component={ChangePassword}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.AccountChanges}
        component={AccountChanges}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.NavigationScreen}
        component={NavigationScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.OfferSound}
        component={OfferSound}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.RingCheck}
        component={RingCheck}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.Account}
        component={Account}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.EarningsDelivery}
        component={EarningsDelivery}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.ReportIssue}
        component={ReportIssue}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.ReportProduct}
        component={ReportProduct}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.RequestRemoval}
        component={RequestRemoval}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.RequestSplit}
        component={RequestSplit}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.Chat}
        component={Chat}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.HowItWorks}
        component={HowItWorks}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.RequestReview}
        component={RequestReview}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.FileComplaint}
        component={FileComplaint}
        options={DEFAULT_OPTIONS}
      />
    </MainStackNavigator.Navigator>
  );
};
