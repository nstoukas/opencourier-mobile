import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { BellRingingIcon } from 'phosphor-react-native/src/icons/BellRinging';
import { FrameCornersIcon } from 'phosphor-react-native/src/icons/FrameCorners';
import { SpeakerHighIcon } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { BatteryHighIcon } from 'phosphor-react-native/src/icons/BatteryHigh';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { Icon } from '@app/components/Icon/Icon';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { useRingCheck } from '@app/hooks/useRingCheck';
import {
  hasRingProblem,
  openFixFor,
  RingCheckId,
  RingCheckItem,
} from '@app/services/ringCheck';
import { styles } from './RingCheck.styles';

type Props = MainScreenProp<MainScreens.RingCheck>;

// One icon per check, so the cards are told apart at a glance.
// `Record<RingCheckId, ...>` makes TypeScript insist on an entry for every check.
const ICONS: Record<RingCheckId, React.ComponentProps<typeof Icon>['icon']> = {
  notifications: BellIcon,
  offer_alerts: BellRingingIcon,
  full_screen: FrameCornersIcon,
  sound: SpeakerHighIcon,
  battery: BatteryHighIcon,
};

// Row 84, the sixth setting: "Is my phone set up to ring?". One card per thing
// that decides whether an offer rings; a card with a problem says what is
// wrong and has a button that opens the phone's own setting for it. The
// answers are read again when the rider comes back from that setting.
export const RingCheck = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const { items, recheck } = useRingCheck();

  const summary =
    items === null
      ? t('translations:ring_check_checking')
      : hasRingProblem(items)
      ? t('translations:ring_check_needs_fixing')
      : t('translations:ring_check_all_good');

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title} accessibilityRole="header">
            {t('translations:ring_check')}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>{t('translations:ring_check_intro')}</Text>
          {/* Said aloud by a screen reader when the answer changes. */}
          <Text style={styles.summary} accessibilityLiveRegion="polite">
            {summary}
          </Text>
          {items?.map(item => (
            <RingCheckCard key={item.id} item={item} />
          ))}
          {items !== null ? (
            <Button
              style={styles.again}
              type={ButtonType.white}
              title={t('translations:ring_check_again')}
              onPress={recheck}
            />
          ) : null}
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};

// One check: its name, then either "OK" or what is wrong and the button that
// opens the setting that fixes it.
const RingCheckCard = ({ item }: { item: RingCheckItem }) => {
  const { t } = useTranslation();
  const problem = item.problem;
  return (
    <View
      testID={`ring-check-${item.id}`}
      style={[styles.card, problem !== null && styles.cardProblem]}>
      <View style={styles.cardHeader}>
        <Icon icon={ICONS[item.id]} size={24} />
        <Text style={styles.cardTitle}>
          {t(`translations:ring_check_label_${item.id}`)}
        </Text>
        {problem === null ? (
          <>
            <Icon
              icon={CheckCircleIcon}
              weight="fill"
              size={20}
              tone="success"
            />
            <Text style={styles.okText}>{t('translations:ring_check_ok')}</Text>
          </>
        ) : null}
      </View>
      {problem !== null ? (
        <>
          <Text style={styles.problemText}>
            {t(`translations:ring_problem_${problem}`)}
          </Text>
          <Button
            type={ButtonType.black}
            title={t('translations:open_settings')}
            onPress={() => {
              openFixFor(problem);
            }}
          />
        </>
      ) : null}
    </View>
  );
};
