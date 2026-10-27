import React, { useMemo } from 'react';
import {
  Image,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './Toast.styles';
import { Images } from '@app/utilities/images';
import { ToastMessage } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { Colors } from '@app/styles/colors';
import { generateBoxShadowStyle } from '@app/utilities/styles';
import { hitSlopFor } from '@app/utilities/touch';

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

  const tintColor = useMemo(() => {
    switch (toast) {
      case ToastMessage.enableNotifications:
        return Colors.gray9;
      case ToastMessage.itemsBagged:
        return Colors.yellow1;
      case ToastMessage.enableLocationServices:
        return Colors.red1;
      case ToastMessage.pickupBeforeContinuing:
        return Colors.red1;
      case ToastMessage.waitingForNewOrders:
        return Colors.green1;
      case ToastMessage.addressCopied:
        return Colors.green1;
      case ToastMessage.get_closer:
        return Colors.red1;
      case ToastMessage.item_may_be_bagged:
        return Colors.blue7;
    }
  }, [toast]);

  return (
    <View
      style={[
        styles.container,
        { borderColor: tintColor, backgroundColor: backgroundColor },
        generateBoxShadowStyle(0, 10, 0.08, 12, 20, Colors.black8),
        style,
      ]}>
      <Image
        source={Images.Info}
        style={{ tintColor: tintColor, marginRight: 8, width: 20, height: 20 }}
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
            <Image source={Images.X} />
          </TouchableOpacity>
        )}
    </View>
  );
};
