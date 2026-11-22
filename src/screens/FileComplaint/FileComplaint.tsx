import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { Icon } from '@app/components/Icon/Icon';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { Colors } from '@app/styles/colors';
import { useFileComplaint } from '@app/hooks/useComplaints';
import { FileComplaintInput } from '@app/services/complaintService';
import { ComplaintCategory } from '@app/types/types';
import { touchRow } from '@app/utilities/touch';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_TEXT_MAX_LENGTH,
  complaintCategoryKey,
} from '@app/utilities/complaints';
import { styles } from '../RequestRemoval/RequestRemoval.styles';

type Props = MainScreenProp<MainScreens.FileComplaint>;

// Who a rider can complain about: the restaurant or the customer, never another rider (row 83).
type RiderAbout = FileComplaintInput['about'];
const ABOUT_CHOICES: { about: RiderAbout; label: string }[] = [
  { about: 'RESTAURANT', label: 'translations:complaint_about_restaurant' },
  { about: 'CUSTOMER', label: 'translations:complaint_about_customer' },
];

// One radio row, as on the review request screen.
const ChoiceRow = ({
  label,
  selected,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) => (
  <TouchableOpacity
    style={touchRow}
    disabled={disabled}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    testID={testID}>
    <View style={styles.row}>
      <Icon
        icon={selected ? CheckCircleIcon : CircleIcon}
        weight={selected ? 'fill' : 'regular'}
        size={20}
        tone={selected ? 'success' : 'muted-foreground'}
      />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <View style={styles.separator} />
  </TouchableOpacity>
);

// Spec 0052 (AC-2): the rider complains about the restaurant or the customer of one of their jobs,
// opened from the job in Earnings (its two month reach is the filing window, cross check 11). Only the
// co-op reads it: the restaurant is not told (cross check 5) and the customer is never contacted. Slice 1
// is text only; the gallery photo comes with slice 2.
export const FileComplaint = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top, bottom } = useSafeAreaInsets();
  const { deliveryId, deliveryLabel } = route.params;
  const send = useFileComplaint();
  const [about, setAbout] = useState<RiderAbout | null>(null);
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [text, setText] = useState('');

  const trimmed = text.trim();
  const canSend =
    !!about && !!category && trimmed.length > 0 && !send.isPending;

  // ScreenSafeArea pads the bottom only on iOS, so Android adds the inset itself (as RequestReview).
  const textBoxInset = {
    paddingBottom: Platform.OS === 'android' ? bottom : 0,
  };

  const chooseAbout = (next: RiderAbout) => {
    // Each party has its own categories, so a category picked for the other one is cleared.
    if (next !== about) {
      setCategory(null);
    }
    setAbout(next);
  };

  const onSend = () => {
    if (!about || !category) {
      return;
    }
    send.mutate(
      { deliveryId, about, category, text: trimmed },
      {
        // Say it went and where the outcome shows, so the rider does not send it again.
        onSuccess: () => {
          Alert.alert(
            t('translations:complaint_sent_title'),
            t('translations:complaint_sent_body'),
          );
          navigation.goBack();
        },
      },
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.offlineGradientArray}
      />
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <Text style={styles.title}>{t('translations:complaint_title')}</Text>
          <BackNavButton onPress={() => navigation.goBack()} />
        </View>
        {/* Lifts the text box above the keyboard on both systems (SDK 35, row 114). */}
        <KeyboardAvoidingView style={styles.keyboardArea} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              {t('translations:complaint_intro', { delivery: deliveryLabel })}
            </Text>
            {ABOUT_CHOICES.map(item => (
              <ChoiceRow
                key={item.about}
                label={t(item.label)}
                selected={about === item.about}
                disabled={send.isPending}
                onPress={() => chooseAbout(item.about)}
                testID={`complaint-about-${item.about}`}
              />
            ))}
            {about ? (
              <>
                <Text style={styles.intro}>
                  {t('translations:complaint_what_happened')}
                </Text>
                {COMPLAINT_CATEGORIES[about].map(code => (
                  <ChoiceRow
                    key={code}
                    label={t(complaintCategoryKey(code))}
                    selected={category === code}
                    disabled={send.isPending}
                    onPress={() => setCategory(code)}
                    testID={`complaint-category-${code}`}
                  />
                ))}
              </>
            ) : null}
            <View style={[styles.noteBox, textBoxInset]}>
              <TextInput
                style={styles.noteInput}
                value={text}
                onChangeText={setText}
                placeholder={t('translations:complaint_text_placeholder')}
                multiline
                maxLength={COMPLAINT_TEXT_MAX_LENGTH}
                testID="complaint-text"
              />
              <Text style={styles.noteCount}>
                {`${text.length}/${COMPLAINT_TEXT_MAX_LENGTH}`}
              </Text>
              {about ? (
                <Text style={styles.intro}>
                  {t(
                    about === 'CUSTOMER'
                      ? 'translations:complaint_only_coop_customer'
                      : 'translations:complaint_only_coop_restaurant',
                  )}
                </Text>
              ) : null}
              <Button
                type={ButtonType.redBGRedText}
                title={t('translations:complaint_send')}
                disabled={!canSend}
                isLoading={send.isPending}
                onPress={onSend}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </View>
  );
};
