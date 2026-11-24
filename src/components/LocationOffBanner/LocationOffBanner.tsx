import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GpsSlashIcon } from 'phosphor-react-native/src/icons/GpsSlash';
import { Icon } from '@app/components/Icon/Icon';
import { useLocationOff } from '@app/services/locationOff';
import { UserStatus } from '@app/types/types';
import { color, radius, shadow, space, typeScale } from '@app/styles/theme';

type Props = {
  userStatus: UserStatus;
};

// Android's own screen for the location switch. A screen the phone does not have falls back to
// this app's page in the phone's settings.
const openLocationSettings = () => {
  const fallback = () =>
    Linking.openSettings().catch(error =>
      console.log('Could not open the settings', error),
    );
  if (Platform.OS !== 'android') {
    fallback();
    return;
  }
  Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(
    fallback,
  );
};

// Row 156: while the rider is Online (or on Last call) and the phone's location is switched off,
// Home says so in one short line, and a tap opens the phone's location settings. It goes away with
// the next fix. Never shown Offline, and nothing about it leaves the phone (value 5).
export const LocationOffBanner = ({ userStatus }: Props) => {
  const { t } = useTranslation();
  const locationOff = useLocationOff();
  if (!locationOff || userStatus === UserStatus.Offline) {
    return null;
  }
  return (
    <Pressable
      onPress={openLocationSettings}
      accessibilityRole="button"
      accessibilityLabel={t('translations:location_off_banner')}
      accessibilityHint={t('translations:location_off_hint')}
      testID="location-off-banner"
      style={styles.card}>
      <Icon icon={GpsSlashIcon} size={20} tone="warning-foreground" />
      <Text style={styles.title}>{t('translations:location_off_banner')}</Text>
      <Text style={styles.action}>
        {t('translations:location_off_turn_on')}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    padding: space['3'],
    borderRadius: radius.md,
    backgroundColor: color.warning,
    ...shadow.md,
  },
  title: {
    flex: 1,
    ...typeScale.caption,
    fontWeight: '700',
    color: color['warning-foreground'],
  },
  action: {
    ...typeScale.caption,
    fontWeight: '700',
    textDecorationLine: 'underline',
    color: color['warning-foreground'],
  },
});
