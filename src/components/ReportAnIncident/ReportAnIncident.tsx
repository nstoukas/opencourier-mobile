import React from 'react';
import { Image, StyleProp, Text, View, ViewStyle } from 'react-native';
import { styles } from './ReportAnIncident.styles';
import { generateBoxShadowStyle } from '@app/utilities/styles';
import { Colors } from '@app/styles/colors';
import { TouchableOpacity } from 'react-native';
import { Button, ButtonType } from '../Button/Button';
import { Images } from '@app/utilities/images';
import { useTranslation } from 'react-i18next';
import { typeScale } from '@app/styles/theme';
import { hitSlopFor } from '@app/utilities/touch';

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
        <Image source={Images.Info} style={styles.iconInfo} />
        <View style={styles.contentRight}>
          <View style={styles.containerHorizontal}>
            <Text style={styles.textReport}>
              {t('translations:report_incident')}
            </Text>
            <TouchableOpacity hitSlop={hitSlopFor(20)} onPress={onDismiss}>
              <Image source={Images.X} style={styles.imageX} />
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
