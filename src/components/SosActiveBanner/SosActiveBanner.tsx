import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SirenIcon } from 'phosphor-react-native/src/icons/Siren';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { Icon } from '@app/components/Icon/Icon';
import { color, radius, shadow, space, typeScale } from '@app/styles/theme';

type Props = {
  onPress: () => void;
};

// Spec 0022 (AC-3): while the rider's SOS is active and they left the SOS
// screen (Android Back), Home says so on top, and a tap reopens it.
export const SosActiveBanner = ({ onPress }: Props) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('translations:sos_active_banner')}
      accessibilityHint={t('translations:sos_active_banner_hint')}
      testID="sos-active-banner"
      style={styles.card}>
      <Icon
        icon={SirenIcon}
        size={20}
        tone="destructive-foreground"
        weight="fill"
      />
      <View style={styles.textBox}>
        <Text style={styles.title}>{t('translations:sos_active_banner')}</Text>
        <Text style={styles.text}>{t('translations:sos_sharing_note')}</Text>
      </View>
      <Icon icon={CaretRightIcon} size={18} tone="destructive-foreground" />
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
    backgroundColor: color.destructive,
    ...shadow.md,
  },
  textBox: {
    flex: 1,
  },
  title: {
    ...typeScale.caption,
    fontWeight: '700',
    color: color['destructive-foreground'],
  },
  text: {
    ...typeScale.caption,
    color: color['destructive-foreground'],
  },
});
