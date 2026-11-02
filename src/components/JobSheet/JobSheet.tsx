import React, { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@app/components/Icon/Icon';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { SCREEN_HEIGHT } from '@app/utilities/constants';
import { color, control, radius, space, typeScale } from '@app/styles/theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
};

// A sheet that slides up over the job card (spec 0021): the notes and the
// items open in one, so the card itself keeps them to a single line. A tap
// on the dimmed map behind, the close button or Android's back closes it.
export const JobSheet = ({
  visible,
  title,
  onClose,
  children,
  testID,
}: Props) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('translations:close')}
      />
      <View
        style={[styles.sheet, { paddingBottom: bottom + space['4'] }]}
        testID={testID}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('translations:close')}>
            <Icon icon={XIcon} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.body}>{children}</ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: color.overlay,
  },
  sheet: {
    backgroundColor: color.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: space['4'],
    paddingTop: space['3'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typeScale.h3,
    color: color.foreground,
  },
  close: {
    width: control.xl,
    height: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
});
