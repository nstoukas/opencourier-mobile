import React, { useEffect, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StackActions } from '@react-navigation/native';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { BellRingingIcon } from 'phosphor-react-native/src/icons/BellRinging';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { Button, ButtonType } from '@app/components/Button/Button';
import { Icon } from '@app/components/Icon/Icon';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { useLocationPermission } from '@app/hooks/useLocationPermission';
import {
  isApproximateLocationOnly,
  isLocationGranted,
  isNotificationsGranted,
  requestNotifications,
} from '@app/utilities/permissions';
import { styles } from './Permissions.styles';

type Props = MainScreenProp<MainScreens.Permissions>;

// Shown once, right after a login or a reset by email, when location or
// notifications is not yet allowed (row 17, spec 0039, AC-15). Says why each is
// needed, asks only when the rider taps Allow, and Continue always works: the
// app never blocks a rider here. Going Online is where location is required.
export const Permissions = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const { requestLocationPermission } = useLocationPermission();
  // null while the phone is being read (and on iOS, where it can't be read
  // without asking: both cards then show).
  const [location, setLocation] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<boolean | null>(null);
  // Location allowed only as "Approximate": the card asks for Precise (decision 17.22).
  const [approximate, setApproximate] = useState(false);
  const [checked, setChecked] = useState(false);

  // Replaces this screen, so Back from Home never returns here.
  const goHome = () =>
    navigation.dispatch(StackActions.replace(MainScreens.Drawer));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loc, notif] = await Promise.all([
        isLocationGranted(),
        isNotificationsGranted(),
      ]);
      if (cancelled) {
        return;
      }
      if (loc === true && notif === true) {
        // Both already allowed: nothing to ask, straight to Home.
        goHome();
        return;
      }
      setLocation(loc);
      setNotifications(notif);
      setApproximate(await isApproximateLocationOnly());
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once, when the screen first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back from the phone's settings (where Allow sends a blocked permission),
  // read the answers again so the cards show what the rider chose there.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async state => {
      if (state !== 'active') {
        return;
      }
      const [loc, notif] = await Promise.all([
        isLocationGranted(),
        isNotificationsGranted(),
      ]);
      // null (iOS) keeps what the last Allow answered.
      if (loc !== null) {
        setLocation(loc);
      }
      setApproximate(await isApproximateLocationOnly());
      if (notif !== null) {
        setNotifications(notif);
      }
    });
    return () => subscription.remove();
  }, []);

  if (!checked) {
    // Blank for the moment it takes to read the phone's answers.
    return <ScreenSafeArea style={styles.safeArea} />;
  }

  const allowLocation = async () => {
    setLocation(
      await requestLocationPermission({ openSettingsIfBlocked: true }),
    );
    setApproximate(await isApproximateLocationOnly());
  };
  const allowNotifications = async () => {
    setNotifications(await requestNotifications());
  };

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {t('translations:permissions_title')}
        </Text>
        <Text style={styles.body}>{t('translations:permissions_body')}</Text>

        <PermissionCard
          icon={MapPinIcon}
          title={t('translations:permission_location_title')}
          why={t('translations:permission_location_why')}
          granted={location === true}
          note={
            approximate && location !== true
              ? t('translations:location_precise_needed')
              : undefined
          }
          onAllow={allowLocation}
          allowLabel={t('translations:allow')}
          allowedLabel={t('translations:allowed')}
        />
        <PermissionCard
          icon={BellRingingIcon}
          title={t('translations:permission_notifications_title')}
          why={t('translations:permission_notifications_why')}
          granted={notifications === true}
          onAllow={allowNotifications}
          allowLabel={t('translations:allow')}
          allowedLabel={t('translations:allowed')}
        />

        <View style={styles.spacer} />
        <Button
          type={ButtonType.black}
          title={t('translations:continue')}
          onPress={goHome}
        />
      </ScrollView>
    </ScreenSafeArea>
  );
};

type CardProps = {
  icon: React.ComponentProps<typeof Icon>['icon'];
  title: string;
  why: string;
  // One more line under the reason, when there is something to fix (approximate location).
  note?: string;
  granted: boolean;
  onAllow: () => void;
  allowLabel: string;
  allowedLabel: string;
};

// One permission: what it is, why the app needs it, and Allow (or Allowed).
const PermissionCard = ({
  icon,
  title,
  why,
  note,
  granted,
  onAllow,
  allowLabel,
  allowedLabel,
}: CardProps) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Icon icon={icon} size={24} />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    <Text style={styles.cardWhy}>{why}</Text>
    {note !== undefined && (
      <Text style={styles.cardNote} accessibilityLiveRegion="polite">
        {note}
      </Text>
    )}
    {granted ? (
      <View style={styles.allowed} accessibilityLiveRegion="polite">
        <Icon icon={CheckCircleIcon} weight="fill" size={20} tone="success" />
        <Text style={styles.allowedText}>{allowedLabel}</Text>
      </View>
    ) : (
      <Button type={ButtonType.white} title={allowLabel} onPress={onAllow} />
    )}
  </View>
);
