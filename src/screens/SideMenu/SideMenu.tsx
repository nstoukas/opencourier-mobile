import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import { RootScreen } from '@app/navigation/types';
import { styles } from './SideMenu.styles';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { ProfileBadge } from '@app/components/ProfileBadge/ProfileBadge';
import { SideMenuItem, UserStatus } from '@app/types/types';
import { UserStatusSelector } from '@app/components/UserStatusSelector/UserStatusSelector';
import { SideMenuItemSwitch } from '@app/components/SideMenuItemSwitch/SideMenuItemSwitch';
import { SideMenuItemPlain } from '@app/components/SideMenuItemPlain/SideMenuItemPlain';
import { DrawerScreens } from '@app/navigation/drawer/types';
import { useTranslation } from 'react-i18next';
import { OrderSetting } from '@app/types/enums';
import { useLocationPermission } from '@app/hooks/useLocationPermission';
import { waitingCount } from '@app/services/jobStepOutbox';
import {
  isSharing,
  loadSosRecord,
  stopSosForLogout,
} from '@app/services/sosStore';
import { clearSavedQueries } from '@app/services/queryPersistence';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useUser from '@app/hooks/useUser';
import { useJobContact } from '@app/hooks/useJobContact';
import { syncShiftReminders } from '@app/services/shifts/shiftReminder';
import { useQueryClient } from '@tanstack/react-query';
import { LOGOUT_OFFLINE_TIMEOUT_MS } from '@app/utilities/constants';
import { services } from '@app/services/service';
import { unregisterThisPhone } from '@app/services/offerPush/registration';
import { cancelAllOfferAlerts } from '@app/services/offerPush/offerAlert';
import { prepareToGoOnline } from '@app/services/offerPush/goOnlineChecks';
import { confirmLocationForOnline } from '@app/services/locationForOnline';
import { useChatUnseen } from '@app/hooks/useChat';
import { MainScreens } from '@app/navigation/main/types';

// The side menu is the drawer's content, not a screen, so it receives the drawer's
// content props (no route), which is the type the drawer library exports for it.
type Props = DrawerContentComponentProps;

const section1 = [SideMenuItem.Location, SideMenuItem.AutoOrders];
const section2 = [
  SideMenuItem.Orders,
  SideMenuItem.Chat,
  SideMenuItem.Earnings,
  SideMenuItem.Complaints,
  SideMenuItem.Payout,
  SideMenuItem.Support,
  SideMenuItem.Settings,
  SideMenuItem.Logout,
];

// Spec 0027: Shifts sits before Earnings, only while the co-op runs shifts. Spec 0042 took History out:
// the Earnings screen lists every job.
const section2WithShifts = [
  SideMenuItem.Orders,
  SideMenuItem.Chat,
  SideMenuItem.Shifts,
  SideMenuItem.Earnings,
  SideMenuItem.Complaints,
  SideMenuItem.Payout,
  SideMenuItem.Support,
  SideMenuItem.Settings,
  SideMenuItem.Logout,
];

export const SideMenu = ({ navigation }: Props) => {
  // Spec 0034 (AC-12): the chat's unread dot, the same one the job's Chat action shows.
  const chatUnseen = useChatUnseen();
  const { t } = useTranslation();
  const { user } = useUser();
  // The last co-op switch the app read (Home keeps it fresh); the menu itself never polls.
  const { data: jobContact } = useJobContact(false);
  const menuItems =
    jobContact?.shiftsEnabled === true ? section2WithShifts : section2;
  const { requestLocationPermission, locationPermission } =
    useLocationPermission();

  const queryClient = useQueryClient();

  const [autoAcceptOrders, setAutoAcceptOrders] = useState<boolean>(
    user?.deliverySetting === OrderSetting.auto_accept,
  );
  const [status, setStatus] = useState<string | undefined>(user?.status);

  const { updateStatus, updateDeliverySettings } = useUser();

  const isSwitchOn = (item: SideMenuItem) => {
    switch (item) {
      case SideMenuItem.AutoOrders:
        return autoAcceptOrders;
      case SideMenuItem.Location:
        // On when the app may use location. It never starts a watch itself:
        // the app tracks only while Online or on a job (row 67).
        return locationPermission;
    }
    return false;
  };

  const handleSwitchValueChange = (item: SideMenuItem, value: boolean) => {
    switch (item) {
      case SideMenuItem.AutoOrders:
        //setAutoAcceptOrdersStorage(value);

        updateDeliverySettings(value ? 'AUTO_ACCEPT' : 'MANUAL');
        setAutoAcceptOrders(value);
        break;
      case SideMenuItem.Location:
        if (value) {
          requestLocationPermission();
        } else {
          // An app cannot take back its own permission; the phone's settings
          // for this app are where the rider switches location off. The switch
          // springs back to on until the rider has done that, as it should.
          Linking.openSettings().catch(() => undefined);
        }
        break;
    }
  };

  useEffect(() => {
    setStatus(user?.status);
  }, [user]);

  const onLogoutHandle = async () => {
    // Take this phone off the rider's push list first, while the session
    // still works (spec 0003, AC-1), so the next person to log in here never
    // gets this rider's offers. It waits at most 3 s and never stops logout.
    await unregisterThisPhone(LOGOUT_OFFLINE_TIMEOUT_MS);
    // Then go Offline, while the session still works (spec 0002, AC-6): the
    // server then ends any offer this rider holds at once and gives it to the
    // next rider, instead of it waiting on a phone that has logged out.
    try {
      // At most 3 s, not the client's usual 10 s.
      await services.userService.setUserStatus(UserStatus.Offline, {
        timeoutMs: LOGOUT_OFFLINE_TIMEOUT_MS,
      });
    } catch (error) {
      // No network, or no answer within 3 s. Logging out must still work, so
      // carry on; an offer left behind still ends at its deadline when expiry
      // is on, and the next login starts Offline.
      console.log('Could not go Offline before logging out', error);
    }
    await AsyncStorage.multiRemove(['token', 'refreshToken']);
    // Nothing may keep ringing on a phone nobody is logged in on.
    await cancelAllOfferAlerts();
    // Nor remind anyone of this rider's shifts (spec 0027, row 78 review).
    await syncShiftReminders([], 0).catch(() => undefined);
    // An active SOS stops being shared (spec 0022, AC-12); a start the
    // server has not had yet waits for this rider's next login.
    if (user?.id) {
      await stopSosForLogout(user.id).catch(error =>
        console.log('Could not stop the SOS before logging out', error),
      );
    }
    services.logout();
    queryClient.resetQueries();
    // The deliveries and earnings kept on the phone for reading offline go
    // too, so the next rider here never sees them (spec 0009, AC-11).
    await clearSavedQueries();
  };

  // A step tapped with no signal is part of the rider's pay record: it can
  // only be sent with this rider's login, so logging out waits for it
  // (spec 0009, AC-8). Reading the count waits for the stored list.
  // If the stored list cannot be read, logout waits too (it fails closed):
  // a step that cannot be counted may still be waiting (row 20 review).
  const onLogoutPress = async () => {
    let waiting = 0;
    try {
      waiting = user?.id ? await waitingCount(user.id) : 0;
    } catch (error) {
      console.log('Could not read the job step outbox before logout', error);
      Alert.alert(
        t('translations:logout_waiting_title'),
        t('translations:logout_outbox_unreadable'),
      );
      return;
    }
    if (waiting > 0) {
      Alert.alert(
        t('translations:logout_waiting_title'),
        t('translations:logout_waiting_body', { count: waiting }),
      );
      return;
    }
    // During an active SOS, logging out stops the sharing: say so first
    // (spec 0022, AC-12). The co-op still sees the SOS until they close it.
    const sos = user?.id
      ? await loadSosRecord(user.id).catch(() => undefined)
      : undefined;
    if (isSharing(sos)) {
      Alert.alert(
        t('translations:sos_logout_title'),
        t('translations:sos_logout_body'),
        [
          { text: t('translations:cancel'), style: 'cancel' },
          {
            text: t('translations:sos_logout_confirm'),
            style: 'destructive',
            onPress: onLogoutHandle,
          },
        ],
      );
      return;
    }
    Alert.alert('Notice', 'Are you sure you want to log out?', [
      { text: 'Yes', onPress: onLogoutHandle },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePress = (item: SideMenuItem) => {
    switch (item) {
      case SideMenuItem.Orders:
        navigation.navigate(DrawerScreens.Home);
        break;
      case SideMenuItem.Chat:
        // A screen of the main stack, which holds the drawer: no delivery tag (AC-12).
        navigation.navigate(MainScreens.Chat);
        break;
      case SideMenuItem.Shifts:
        navigation.navigate(DrawerScreens.Shifts);
        break;
      case SideMenuItem.Earnings:
        navigation.navigate(DrawerScreens.Earnings);
        break;
      case SideMenuItem.Complaints:
        // Spec 0052 (cross check 11): Complaints sits in the side menu. No count or badge: the push and
        // the card say when one needs a reply (value 5).
        navigation.navigate(DrawerScreens.Complaints);
        break;
      case SideMenuItem.Payout:
        navigation.navigate(DrawerScreens.PaymentMethods);
        break;
      case SideMenuItem.Support:
        break;
      case SideMenuItem.Settings:
        navigation.navigate(DrawerScreens.Settings);
        break;
      case SideMenuItem.Logout:
        onLogoutPress();
        break;
    }
  };

  const onUserStatusSelect = (newStatus: UserStatus) => {
    if (newStatus === status) {
      return;
    }
    if (status === UserStatus.Offline && newStatus === UserStatus.LastCall) {
      return;
    }
    navigation.navigate(RootScreen.UserStatusModal, {
      status: newStatus,
      onAccept: async () => {
        if (newStatus === UserStatus.Online) {
          // Location first: refused, the rider stays as they are and is told
          // why (row 17, spec 0039, AC-16).
          if (
            !(await confirmLocationForOnline(() => requestLocationPermission()))
          ) {
            return;
          }
          // Then, the first time, ask for the alert permissions; every time,
          // warn if the phone is on silent (spec 0003, AC-8, AC-9). The rider
          // decides; either answer goes Online.
          await prepareToGoOnline();
        }
        updateStatus(newStatus);
      },
      onCancel: () => undefined,
    });
  };

  return (
    <DrawerContentScrollView>
      <View style={styles.container}>
        <View style={styles.containerProfile}>
          <ProfileBadge
            discreteStatusIndicator
            userStatus={status as UserStatus}
            onPress={() => undefined}
          />
          {/* Logout clears the user while this menu is still drawn, for a moment
              before the login screen replaces it, so the name may be missing.
              Reading it with `!` threw there and left a blank screen (row 116). */}
          <Text style={styles.textName}>
            {user
              ? `${t('translations:hi')} ${user.firstName}!`
              : `${t('translations:hi')}!`}
          </Text>
        </View>
        <UserStatusSelector
          style={styles.cell}
          selected={status as UserStatus}
          onPress={onUserStatusSelect}
        />
        <View style={styles.separator} />
        {section1.map(item => {
          return (
            <SideMenuItemSwitch
              key={item}
              style={styles.cell}
              isOn={isSwitchOn(item)}
              item={item}
              onValueChange={value => handleSwitchValueChange(item, value)}
            />
          );
        })}
        <View style={styles.separator} />
        {menuItems.map(item => {
          return (
            <SideMenuItemPlain
              hideArrow={item === SideMenuItem.Logout}
              dot={item === SideMenuItem.Chat && chatUnseen}
              key={item}
              style={styles.cell}
              item={item}
              onPress={handlePress}
            />
          );
        })}
      </View>
    </DrawerContentScrollView>
  );
};
