import React, { useState } from 'react';
import {
  View,
  Image,
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
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
import { Icon } from '@app/components/Icon/Icon';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { FlagIcon } from 'phosphor-react-native/src/icons/Flag';
import { services } from '@app/services/service';
import { DeliveryIssueReason } from '@app/types/enums';

type Props = MainScreenProp<MainScreens.ReportIssue>;

export const ReportIssue = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { order } = route.params;
  const [didSelectIssue, setDidSelectIssue] = useState<boolean>(false);
  // True while a report is on its way, so a second tap cannot send it twice.
  const [sending, setSending] = useState<boolean>(false);

  const items = [
    {
      reason: DeliveryIssueReason.WrongAddress,
      label: t('translations:wrong_address'),
    },
    {
      reason: DeliveryIssueReason.NoSignal,
      label: t('translations:no_signal'),
    },
    {
      reason: DeliveryIssueReason.OrderHanded,
      label: t('translations:order_handed'),
    },
  ];

  // Sends the report to the server, where the admin reads it (decision 66.11),
  // and thanks the rider only once it has arrived.
  const sendReport = async (reason: DeliveryIssueReason) => {
    if (sending) {
      return;
    }
    setSending(true);
    try {
      await services.orderService.reportIssue({ id: order.id, reason });
      setDidSelectIssue(true);
    } catch (error) {
      console.log('Could not send the report', error);
      Alert.alert(
        t('translations:report_failed_title'),
        t('translations:report_failed_body'),
      );
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: (typeof items)[number] }) => {
    return (
      <TouchableOpacity
        style={touchRow}
        disabled={sending}
        onPress={() => sendReport(item.reason)}>
        <View style={styles.cellHorizonal}>
          <Text style={styles.cellText}>{item.label}</Text>
          <Icon icon={CaretRightIcon} size={14} />
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
              keyExtractor={item => item.reason}
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
              title={t('translations:report_sent_back')}
              onPress={() => navigation.goBack()}
              iconPosition="left"
              icon={FlagIcon}
              iconWeight="fill"
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};
