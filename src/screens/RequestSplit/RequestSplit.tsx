import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { Colors } from '@app/styles/colors';
import { useSendSplitRequest, useSplitBusy } from '@app/hooks/useSplitRequest';
import { SplitBoxSize } from '@app/types/types';
import {
  SPLIT_MAX_BOXES,
  SPLIT_MIN_BOXES,
  SPLIT_SIZES,
  allBoxesSized,
  resizeBoxes,
} from '@app/utilities/splitRequest';
import { styles } from './RequestSplit.styles';

type Props = MainScreenProp<MainScreens.RequestSplit>;

const COUNTS = Array.from(
  { length: SPLIT_MAX_BOXES - SPLIT_MIN_BOXES + 1 },
  (_, index) => SPLIT_MIN_BOXES + index,
);

// Spec 0047 (AC-1): the order does not fit one box. The rider says how many
// boxes it needs and a size for each, and sends it to dispatch. Box 1 is the
// one the rider keeps; the rest go to other riders, each paid in full.
export const RequestSplit = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { order } = route.params;
  const { send } = useSendSplitRequest();
  const sending = useSplitBusy(order.id);
  const [sizes, setSizes] = useState<(SplitBoxSize | null)[]>([null, null]);

  const onSend = () => {
    if (!allBoxesSized(sizes)) {
      return;
    }
    send({ orderId: order.id, legs: sizes.map(boxSize => ({ boxSize })) }, () =>
      navigation.goBack(),
    );
  };

  const pill = (
    label: string,
    selected: boolean,
    onPress: () => void,
    testID: string,
  ) => (
    <TouchableOpacity
      key={testID}
      style={[styles.pill, selected && styles.pillSelected]}
      disabled={sending}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      testID={testID}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.onlineGradientArray}
      />
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <Text style={styles.title}>{t('translations:split_title')}</Text>
          <BackNavButton onPress={() => navigation.goBack()} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>{t('translations:split_intro')}</Text>

          <Text style={styles.label}>{t('translations:split_box_count')}</Text>
          <View style={styles.row} accessibilityRole="radiogroup">
            {COUNTS.map(count =>
              pill(
                String(count),
                sizes.length === count,
                () => setSizes(resizeBoxes(sizes, count)),
                `split-count-${count}`,
              ),
            )}
          </View>

          {sizes.map((size, index) => (
            <View key={index}>
              <Text style={styles.label}>
                {index === 0
                  ? t('translations:split_box_yours')
                  : t('translations:split_box_n', { n: index + 1 })}
              </Text>
              <View style={styles.row} accessibilityRole="radiogroup">
                {SPLIT_SIZES.map(option =>
                  pill(
                    t(`translations:split_size_${option}`),
                    size === option,
                    () =>
                      setSizes(
                        sizes.map((item, i) => (i === index ? option : item)),
                      ),
                    `split-box-${index + 1}-${option}`,
                  ),
                )}
              </View>
            </View>
          ))}
        </ScrollView>
        <Button
          type={ButtonType.black}
          title={t('translations:split_send')}
          disabled={!allBoxesSized(sizes) || sending}
          isLoading={sending}
          onPress={onSend}
        />
      </ScreenSafeArea>
    </View>
  );
};
