import React, { useState } from 'react';
import {
  View,
  Image,
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Images } from '@app/utilities/images';
import { styles } from './ReportIssue.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import LinearGradient from 'react-native-linear-gradient';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@app/styles/colors';
import { Button, ButtonType } from '@app/components/Button/Button';
import { touchRow } from '@app/utilities/touch';

type Props = MainScreenProp<MainScreens.ReportIssue>;

export const ReportIssue = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { order } = route.params;
  const [didSelectIssue, setDidSelectIssue] = useState<boolean>(false);

  const items = [
    t('translations:wrong_address'),
    t('translations:no_signal'),
    t('translations:order_handed'),
  ];

  const renderItem = ({ item }: { item: string }) => {
    return (
      <TouchableOpacity
        style={touchRow}
        onPress={() => setDidSelectIssue(true)}>
        <View style={styles.cellHorizonal}>
          <Text style={styles.cellText}>{item}</Text>
          <Image source={Images.ArrowRightBlack} style={styles.arrow} />
        </View>
        <View style={styles.separator} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.onlineGradientArray}
      />
      <SafeAreaView style={styles.safe}>
        {!didSelectIssue && (
          <>
            <View style={styles.navHeader}>
              <Text style={styles.title}>{t('translations:report_issue')}</Text>
              <BackNavButton onPress={() => navigation.goBack()} />
            </View>

            <FlatList
              keyExtractor={(item, index) => index.toString()}
              data={items}
              renderItem={renderItem}
            />
          </>
        )}

        {didSelectIssue && (
          <View style={styles.contentReported}>
            <Image source={Images.Cone} />
            <Text style={styles.textThanks}>
              {t('translations:thanks_for_report')}
            </Text>
            <Text style={styles.textErrors}>
              {t('translations:errors_prevent_couriers')}
            </Text>
            <Button
              type={ButtonType.yellow}
              title={t('translations:report_and_finalize')}
              onPress={() => navigation.goBack()}
              iconPosition="left"
              icon={Images.Flag}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};
