import React, { useMemo } from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './Toast.styles';
import { ToastMessage } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { Colors } from '@app/styles/colors';
import { generateBoxShadowStyle } from '@app/utilities/styles';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { color, ColorName } from '@app/styles/theme';

type Props = {
  style?: StyleProp<ViewStyle>;
  onClose?: () => void;
  toast: ToastMessage;
  onEnable?: () => void;
  disableClose?: boolean;
};

export const Toast = ({
  style,
  onClose,
  toast,
  onEnable,
  disableClose = false,
}: Props) => {
  const { t } = useTranslation();

  const backgroundColor = useMemo(() => {
    switch (toast) {
      case ToastMessage.enableNotifications:
        return Colors.gray20;
      case ToastMessage.itemsBagged:
        return Colors.yellow4;
      case ToastMessage.enableLocationServices:
        return Colors.red5;
      case ToastMessage.pickupBeforeContinuing:
        return Colors.red5;
      case ToastMessage.waitingForNewOrders:
        return Colors.green7;
      case ToastMessage.addressCopied:
        return Colors.green7;
      case ToastMessage.get_closer:
        return Colors.red5;
      case ToastMessage.item_may_be_bagged:
        return Colors.gray20;
    }
  }, [toast]);

  // The toast's accent as a token name: its border and its icon take it (spec 0007).
  const tintTone = useMemo((): ColorName | undefined => {
    switch (toast) {
      case ToastMessage.enableNotifications:
        return 'input';
      case ToastMessage.itemsBagged:
        return 'warning';
      case ToastMessage.enableLocationServices:
        return 'destructive';
      case ToastMessage.pickupBeforeContinuing:
        return 'destructive';
      case ToastMessage.waitingForNewOrders:
        return 'success';
      case ToastMessage.addressCopied:
        return 'success';
      case ToastMessage.get_closer:
        return 'destructive';
      case ToastMessage.item_may_be_bagged:
        return 'info';
    }
  }, [toast]);
  const tintColor = tintTone ? color[tintTone] : undefined;

  return (
    <View
      style={[
        styles.container,
        { borderColor: tintColor, backgroundColor: backgroundColor },
        generateBoxShadowStyle(0, 10, 0.08, 12, 20, Colors.black8),
        style,
      ]}>
      <Icon
        icon={InfoIcon}
        weight="fill"
        size={20}
        tone={tintTone}
        style={styles.iconInfo}
      />
      <Text style={styles.text}>{t(`translations:${toast}`)}</Text>
      {(toast === ToastMessage.enableNotifications ||
        toast === ToastMessage.enableLocationServices) && (
        <TouchableOpacity
          style={styles.buttonEnable}
          onPress={() => onEnable && onEnable()}>
          <View style={styles.separator} />
          <Text style={styles.textEnable}>{t('translations:enable')}</Text>
        </TouchableOpacity>
      )}
      {toast !== ToastMessage.waitingForNewOrders &&
        toast !== ToastMessage.pickupBeforeContinuing &&
        !disableClose && (
          <TouchableOpacity
            hitSlop={hitSlopFor(40)}
            style={styles.buttonClose}
            onPress={() => onClose && onClose()}>
            <View style={styles.separator} />
            <Icon icon={XIcon} size={10} />
          </TouchableOpacity>
        )}
    </View>
  );
};
