import React from 'react';
import { MainScreens } from './types';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerStack } from '../drawer/DrawerNavigation';
import { ItemsCollected } from '@app/screens/ItemsCollected/ItemsCollected';
import { MarkAsDelivered } from '@app/screens/MarkAsDelivered/MarkAsDelivered';
import { PhotoAttachment } from '@app/screens/PhotoAttachment/PhotoAttachment';
import { PayoutActivity } from '@app/screens/PayoutActivity/PayoutActivity';
import { LicencesScreen } from '@app/screens/Licences/Licences';
import { LanguageScreen } from '@app/screens/SettingsStack/Language/Language';
import { AccessibilityScreen } from '@app/screens/SettingsStack/Accessibility/Accessibility';
import { EmergencyContact } from '@app/screens/SettingsStack/EmergencyContact/EmergencyContact';
import { MyLanguages } from '@app/screens/SettingsStack/MyLanguages/MyLanguages';
import { NavigationScreen } from '@app/screens/SettingsStack/Navigation/Navigation';
import { OperatingArea } from '@app/screens/SettingsStack/OperatingArea/OperatingArea';
import { ThemeScreen } from '@app/screens/SettingsStack/Theme/Theme';
import { DefaultSound } from '@app/screens/SettingsStack/DefaultSound/DefaultSound';
import { VolumeScreen } from '@app/screens/SettingsStack/Volume/Volume';
import { VehicleTypeScreen } from '@app/screens/SettingsStack/VehicleType/VehicleType';
import { RestaurantTypeScreen } from '@app/screens/SettingsStack/RestaurantType/RestaurantType';
import { CuisineTypeScreen } from '@app/screens/SettingsStack/CuisineType/CuisineType';
import { EarningsMethodScreen } from '@app/screens/SettingsStack/EarningsMethod/EarningsMethod';
import { EarningsDay } from '@app/screens/EarningsDay/EarningsDay';
import { EarningsDelivery } from '@app/screens/EarningsDelivery/EarningsDelivery';
import { OrderPreferenceScreen } from '@app/screens/SettingsStack/OrderPreference/OrderPreference';
import { WeightOrderScreen } from '@app/screens/SettingsStack/WeightOrder/WeightOrder';
import { ShiftAvailabilityScreen } from '@app/screens/SettingsStack/ShiftAvailability/ShiftAvailabilityScreen';
import { ReportIssue } from '@app/screens/ReportIssue/ReportIssue';

const MainStackNavigator = createNativeStackNavigator();

const DEFAULT_OPTIONS = { headerShown: false };

export const MainStack = () => {
  return (
    <MainStackNavigator.Navigator initialRouteName={MainScreens.Drawer}>
      <MainStackNavigator.Screen
        name={MainScreens.Drawer}
        component={DrawerStack}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.ItemsCollected}
        component={ItemsCollected}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.MarkAsDelivered}
        component={MarkAsDelivered}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.PhotoAttachment}
        component={PhotoAttachment}
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
        name={MainScreens.Accessibility}
        component={AccessibilityScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.EmergencyContact}
        component={EmergencyContact}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.MyLanguages}
        component={MyLanguages}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.NavigationScreen}
        component={NavigationScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.OperatingArea}
        component={OperatingArea}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.ThemeScreen}
        component={ThemeScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.DefaultSound}
        component={DefaultSound}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.VolumeScreen}
        component={VolumeScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.VehicleTypeScreen}
        component={VehicleTypeScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.RestaurantTypeScreen}
        component={RestaurantTypeScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.CuisineTypeScreen}
        component={CuisineTypeScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.EarningsMethodScreen}
        component={EarningsMethodScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.EarningsDay}
        component={EarningsDay}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.EarningsDelivery}
        component={EarningsDelivery}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.OrderPreferenceScreen}
        component={OrderPreferenceScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.WeightOrderScreen}
        component={WeightOrderScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.ShiftAvailabilityScreen}
        component={ShiftAvailabilityScreen}
        options={DEFAULT_OPTIONS}
      />
      <MainStackNavigator.Screen
        name={MainScreens.ReportIssue}
        component={ReportIssue}
        options={DEFAULT_OPTIONS}
      />
    </MainStackNavigator.Navigator>
  );
};
