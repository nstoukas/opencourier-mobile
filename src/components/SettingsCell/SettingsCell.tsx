import React from 'react';
import {
  Image,
  StyleProp,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './SettingsCell.styles';
import { Images } from '@app/utilities/images';
import { useTranslation } from 'react-i18next';
import { hitSlopFor } from '@app/utilities/touch';

export enum SettingsCellType {
  plain,
  radioButton,
  switch,
  deleteOption,
}

export enum RadioButtonType {
  circle,
  checkmark,
}

type Props = {
  style?: StyleProp<ViewStyle>;
  cellType: SettingsCellType;
  title: string;
  subtitle?: string;
  switchValue?: boolean;
  isSelected?: boolean;
  radioButtonType?: RadioButtonType;
  onSwitchValueChange?: (isOn: boolean) => void;
  onPress?: (title: string) => void;
  onDelete?: (title: string) => void;
  onSelect?: (title: string) => void;
};

export const SettingsCell = ({
  style,
  cellType,
  title,
  subtitle = '',
  switchValue = false,
  isSelected = false,
  radioButtonType = RadioButtonType.checkmark,
  onSwitchValueChange,
  onPress,
  onDelete,
  onSelect,
}: Props) => {
  const { t } = useTranslation();

  return (
    <View style={style}>
      {cellType === SettingsCellType.plain && (
        <TouchableOpacity
          style={styles.content}
          onPress={() => onPress && onPress(title)}>
          <View style={styles.containerVerticalText}>
            <Text style={styles.textTitle}>{t(`translations:${title}`)}</Text>
            {subtitle !== undefined && (
              <Text style={styles.textSubtitle}>
                {t(`translations:${subtitle}`)}
              </Text>
            )}
          </View>
          <Image
            source={Images.ArrowRightBlack}
            style={styles.imageArrowRight}
          />
        </TouchableOpacity>
      )}
      {cellType === SettingsCellType.switch && (
        <View style={styles.content}>
          <View style={styles.containerVerticalText}>
            <Text style={styles.textTitle}>{t(`translations:${title}`)}</Text>
            <Text style={styles.textSubtitle}>
              {t(`translations:${subtitle}`)}
            </Text>
          </View>
          <Switch value={switchValue} onValueChange={onSwitchValueChange} />
        </View>
      )}
      {cellType === SettingsCellType.radioButton && (
        <>
          <TouchableOpacity
            style={[styles.content, { alignItems: 'flex-start' }]}
            onPress={() => onSelect && onSelect(title)}>
            <Image
              source={
                isSelected ? Images.RadioSelected : Images.RadioUnselected
              }
              style={styles.imageRadioButton}
            />
            <View style={[styles.containerVerticalText, { marginLeft: 10 }]}>
              <Text style={styles.textTitle}>{t(`translations:${title}`)}</Text>
              {subtitle && (
                <Text style={styles.textSubtitle}>
                  {subtitle.includes('translations')
                    ? subtitle
                    : t(`translations:${subtitle}`)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.separator} />
        </>
      )}
      {cellType === SettingsCellType.deleteOption && (
        <>
          <View style={styles.content}>
            <View style={[styles.containerVerticalText, { marginLeft: 10 }]}>
              <Text style={styles.textTitle}>
                {t(`translations:${title}`).includes('translations')
                  ? title
                  : t(`translations:${title}`)}
              </Text>
            </View>
            <TouchableOpacity
              hitSlop={hitSlopFor(20)}
              onPress={() => onDelete && onDelete(title)}>
              <Image source={Images.Trash} style={{ tintColor: 'black' }} />
            </TouchableOpacity>
          </View>
          <View style={styles.separator} />
        </>
      )}
    </View>
  );
};
