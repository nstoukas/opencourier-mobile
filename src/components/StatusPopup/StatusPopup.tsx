import React, { useMemo } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { styles } from './StatusPopup.styles';
import { UserStatus } from '@app/types/types';
import { Button, ButtonType } from '../Button/Button';
import { useTranslation } from 'react-i18next';
import { typeScale } from '@app/styles/theme';
import { Icon } from '@app/components/Icon/Icon';
import { FlagCheckeredIcon } from 'phosphor-react-native/src/icons/FlagCheckered';
import { PowerIcon } from 'phosphor-react-native/src/icons/Power';
import { SteeringWheelIcon } from 'phosphor-react-native/src/icons/SteeringWheel';

type Props = {
  style?: StyleProp<ViewStyle>;
  type: UserStatus;
  onAccept: (status: UserStatus) => void;
  onCancel: () => void;
};

export const StatusPopup = ({ style, type, onAccept, onCancel }: Props) => {
  const { t } = useTranslation();
  const title = useMemo(() => {
    switch (type) {
      case UserStatus.Online:
        return t('translations:going_online');
      case UserStatus.Offline:
        return t('translations:going_offline');
      case UserStatus.LastCall:
        return t('translations:going_last_call');
    }
  }, [type]);

  const subtitle = useMemo(() => {
    switch (type) {
      case UserStatus.Online:
        return t('translations:start_recieving_orders');
      case UserStatus.Offline:
        return t('translations:switching_disrupts_orders');
      case UserStatus.LastCall:
        return t('translations:ending_soon');
    }
  }, [type]);

  const primaryButtonType = useMemo(() => {
    switch (type) {
      case UserStatus.Online:
        return ButtonType.green;
      case UserStatus.Offline:
        return ButtonType.red;
      case UserStatus.LastCall:
        return ButtonType.yellow;
    }
  }, [type]);

  const primaryButtonTitle = useMemo(() => {
    switch (type) {
      case UserStatus.Online:
        return t('translations:go_online');
      case UserStatus.Offline:
        return t('translations:go_offline');
      case UserStatus.LastCall:
        return t('translations:confirm_last_call');
    }
  }, [type]);

  const image = useMemo(() => {
    switch (type) {
      case UserStatus.Online:
        return SteeringWheelIcon;
      case UserStatus.Offline:
        return PowerIcon;
      case UserStatus.LastCall:
        return FlagCheckeredIcon;
    }
  }, [type]);

  return (
    <View style={styles.content}>
      <View style={[styles.container, style]}>
        <View style={styles.containerHorizontal}>
          {image && <Icon icon={image} style={styles.image} />}
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <Button
              style={{ marginBottom: 12 }}
              type={primaryButtonType}
              title={primaryButtonTitle}
              onPress={() => onAccept(type)}
              textStyle={{ fontSize: typeScale['body-sm'].fontSize }}
            />
            <Button
              type={ButtonType.grayBGBlackText}
              title={t('translations:cancel')}
              onPress={onCancel}
              textStyle={{ fontSize: typeScale['body-sm'].fontSize }}
            />
          </View>
        </View>
      </View>
    </View>
  );
};
