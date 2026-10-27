import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { styles } from './ReportAnIncident.styles';
import { generateBoxShadowStyle } from '@app/utilities/styles';
import { Colors } from '@app/styles/colors';
import { TouchableOpacity } from 'react-native';
import { Button, ButtonType } from '../Button/Button';
import { useTranslation } from 'react-i18next';
import { typeScale } from '@app/styles/theme';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { XIcon } from 'phosphor-react-native/src/icons/X';

type Props = {
  style?: StyleProp<ViewStyle>;
  onDismiss: () => void;
};

export const ReportAnIncident = ({ style, onDismiss }: Props) => {
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.container,
        generateBoxShadowStyle(0, 10, 0.08, 12, 21, Colors.black8),
        style,
      ]}>
      <View style={styles.containerRight}>
        <Icon icon={InfoIcon} weight="fill" style={styles.iconInfo} />
        <View style={styles.contentRight}>
          <View style={styles.containerHorizontal}>
            <Text style={styles.textReport}>
              {t('translations:report_incident')}
            </Text>
            <TouchableOpacity hitSlop={hitSlopFor(20)} onPress={onDismiss}>
              <Icon icon={XIcon} size={20} />
            </TouchableOpacity>
          </View>
          <Text style={styles.textReportDetails}>
            {t('translations:report_incident_text')}
          </Text>
          <Button
            textStyle={{
              fontSize: typeScale['body-sm'].fontSize,
              fontWeight: '700',
              lineHeight: typeScale['body-sm'].lineHeight,
              color: Colors.black8,
            }}
            type={ButtonType.grayBGBlackText}
            style={{ width: 176 }}
            title={t('translations:dismiss')}
            onPress={onDismiss}
          />
        </View>
      </View>
    </View>
  );
};
