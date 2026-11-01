import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDispatchState } from '@app/hooks/useDispatchState';
import { Icon } from '@app/components/Icon/Icon';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { styles } from './DispatchStopBanner.styles';

// Spec 0014, AC-7: tells the rider that dispatch is stopped (heat, a storm) and until when, or that a
// stop starts soon, so a quiet Home has a reason. The sentence is the backend's.
export const DispatchStopBanner = () => {
  const { t } = useTranslation();
  const { data } = useDispatchState();
  const stop = data?.current ?? data?.next;
  if (!stop) {
    return null;
  }
  const isOn = Boolean(data?.current);

  return (
    <View style={styles.wrap} testID="dispatch-stop-banner">
      <View
        style={[styles.card, isOn ? styles.stopped : styles.soon]}
        accessibilityRole={isOn ? 'alert' : 'text'}>
        <Icon
          icon={isOn ? WarningIcon : ClockIcon}
          size={20}
          tone={isOn ? 'destructive' : 'muted-foreground'}
        />
        <View style={styles.textBox}>
          <Text style={styles.title}>
            {t(
              isOn
                ? 'translations:dispatch_stopped_title'
                : 'translations:dispatch_stops_soon_title',
            )}
          </Text>
          <Text style={styles.text}>{stop.message}</Text>
        </View>
      </View>
    </View>
  );
};
