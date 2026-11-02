import React, { useEffect, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SirenIcon } from 'phosphor-react-native/src/icons/Siren';
import { PhoneCallIcon } from 'phosphor-react-native/src/icons/PhoneCall';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { Icon } from '@app/components/Icon/Icon';
import { Button, ButtonType } from '@app/components/Button/Button';
import useUser from '@app/hooks/useUser';
import { useLocationPermission } from '@app/hooks/useLocationPermission';
import {
  dialEmergency,
  useSosRecord,
  useSosSendOutcome,
} from '@app/hooks/useSos';
import { SosEnd, endSos, isSharing } from '@app/services/sosStore';
import { color, radius, space, typeScale } from '@app/styles/theme';

// Spec 0022 (AC-3, AC-6): the rider's SOS. Opened by the 3 s hold, after a
// restart while the SOS is active, or from Home's "SOS active" banner. It
// says whether the co-op has the alert yet, offers 112 again, and ends the
// sharing with "I'm safe" or "False alarm". Android Back just leaves it: the
// SOS stays active and Home shows the banner.
export const SosScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { top, bottom } = useSafeAreaInsets();
  const { user } = useUser();
  const courierId = user?.id;
  const record = useSosRecord(courierId);
  const outcome = useSosSendOutcome();
  const { locationPermission } = useLocationPermission();
  const sharing = isSharing(record);

  // Close to Home once the SOS stops being shared here: the rider ended it, or
  // the co-op closed it. Only after it was seen shared, so the screen does not
  // close while the phone's storage is still being read at launch.
  const seenSharing = useRef(false);
  useEffect(() => {
    if (sharing) {
      seenSharing.current = true;
      return;
    }
    if (seenSharing.current && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [sharing, navigation]);

  // "I'm safe" and "False alarm" ask once (AC-6), then stop the sharing at
  // once on the phone; the sender tells the server after the start.
  const confirmEnd = (kind: SosEnd['kind']) => {
    if (!courierId) {
      return;
    }
    const safe = kind === 'safe';
    Alert.alert(
      t(
        safe
          ? 'translations:sos_confirm_safe_title'
          : 'translations:sos_confirm_false_alarm_title',
      ),
      t(
        safe
          ? 'translations:sos_confirm_safe_body'
          : 'translations:sos_confirm_false_alarm_body',
      ),
      [
        { text: t('translations:cancel'), style: 'cancel' },
        {
          text: t('translations:sos_confirm_yes'),
          onPress: () => {
            endSos(courierId, { kind, tappedAt: Date.now() }).catch(error =>
              console.log('Could not end the SOS', error),
            );
          },
        },
      ],
    );
  };

  const alerted = !!record?.incidentId;
  const waiting = !alerted || (record?.points.length ?? 0) > 0;
  const noSignal = outcome === 'noSignal' && waiting;

  return (
    <View style={[styles.screen, { paddingTop: top, paddingBottom: bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header} accessibilityRole="header">
          <View style={styles.siren}>
            <Icon
              icon={SirenIcon}
              size={40}
              tone="destructive-foreground"
              weight="fill"
            />
          </View>
          <Text style={styles.title}>{t('translations:sos_title')}</Text>
        </View>

        <View style={styles.statusCard} accessibilityLiveRegion="polite">
          <View style={styles.statusRow}>
            <Icon
              icon={alerted ? CheckCircleIcon : WarningCircleIcon}
              size={22}
              tone={alerted ? 'success' : 'destructive'}
              weight="fill"
            />
            <Text style={styles.statusText} testID="sos-status">
              {t(
                alerted
                  ? 'translations:sos_alerted'
                  : 'translations:sos_alerting',
              )}
            </Text>
          </View>
          {noSignal && (
            <Text style={styles.note} testID="sos-no-signal">
              {t('translations:sos_no_signal')}
            </Text>
          )}
          <Text style={styles.note}>
            {t(
              locationPermission
                ? 'translations:sos_sharing_note'
                : 'translations:sos_no_location',
            )}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={t('translations:sos_call_112')}
            type={ButtonType.red}
            icon={PhoneCallIcon}
            iconWeight="fill"
            onPress={dialEmergency}
            style={styles.callButton}
          />
          <Text style={styles.hint}>{t('translations:sos_call_112_hint')}</Text>
          <Button
            title={t('translations:sos_im_safe')}
            type={ButtonType.green}
            icon={ShieldCheckIcon}
            onPress={() => confirmEnd('safe')}
            disabled={!sharing}
          />
          <Button
            title={t('translations:sos_false_alarm')}
            type={ButtonType.gray}
            onPress={() => confirmEnd('falseAlarm')}
            disabled={!sharing}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    padding: space['6'],
    gap: space['6'],
  },
  header: {
    alignItems: 'center',
    gap: space['3'],
    paddingTop: space['8'],
  },
  siren: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: color.destructive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typeScale.h1,
    color: color.destructive,
  },
  statusCard: {
    gap: space['2'],
    padding: space['4'],
    borderRadius: radius.lg,
    backgroundColor: color['destructive-soft'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  statusText: {
    ...typeScale.lead,
    fontWeight: '600',
    color: color.foreground,
    flex: 1,
  },
  note: {
    ...typeScale.body,
    color: color.foreground,
  },
  actions: {
    gap: space['3'],
  },
  callButton: {
    minHeight: 64,
  },
  hint: {
    ...typeScale.caption,
    color: color['muted-foreground'],
    textAlign: 'center',
  },
});
