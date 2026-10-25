import React from 'react';
import { DrawerScreens, DrawerStackParamList } from './types';
import { HomeScreen } from '@app/screens/Home/Home';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SideMenu } from '@app/screens/SideMenu/SideMenu';
import { Earnings } from '@app/screens/Earnings/Earnings';
import { PaymentMethods } from '@app/screens/PaymentMethods/PaymentMethods';
import { SettingsScreen } from '@app/screens/Settings/Settings';

// Same idea as the main stack: the param list types each drawer screen's route.
const DrawerNavigator = createDrawerNavigator<DrawerStackParamList>();

const DEFAULT_OPTIONS = { headerShown: false };

export const DrawerStack = () => {
  return (
    <DrawerNavigator.Navigator
      initialRouteName={DrawerScreens.Home}
      drawerContent={props => <SideMenu {...props} />}>
      <DrawerNavigator.Screen
        name={DrawerScreens.Home}
        component={HomeScreen}
        options={DEFAULT_OPTIONS}
      />
      <DrawerNavigator.Screen
        name={DrawerScreens.Earnings}
        component={Earnings}
        options={DEFAULT_OPTIONS}
      />
      <DrawerNavigator.Screen
        name={DrawerScreens.PaymentMethods}
        component={PaymentMethods}
        options={DEFAULT_OPTIONS}
      />
      <DrawerNavigator.Screen
        name={DrawerScreens.Settings}
        component={SettingsScreen}
        options={DEFAULT_OPTIONS}
      />
    </DrawerNavigator.Navigator>
  );
};
