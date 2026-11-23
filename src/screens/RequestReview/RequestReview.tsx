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
import moment from 'moment';
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
import { useSendReviewRequest } from '@app/hooks/useReviewRequests';
import { ReviewTopic } from '@app/types/types';
import { touchRow } from '@app/utilities/touch';
import { formatShift, formatSpaced } from '@app/utilities/dates';
import { styles } from '../RequestRemoval/RequestRemoval.styles';

type Props = MainScreenProp<MainScreens.RequestReview>;

// The backend keeps a note of 1000 characters at most (spec 0038, AC-1).
export const REVIEW_NOTE_MAX_LENGTH = 1000;

const TOPICS: { topic: ReviewTopic; label: string }[] = [
  { topic: 'OFFER', label: 'translations:review_topic_offer' },
  { topic: 'PAY', label: 'translations:review_topic_pay' },
  { topic: 'OTHER', label: 'translations:review_topic_other' },
];

// Spec 0038 (AC-1): the rider asks a person to look again at a decision the app took. About one
// delivery (from its pay breakdown) or in general (from the explanation page). A person answers in
// writing by the due date; nothing is decided by the app.
export const RequestReview = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top, bottom } = useSafeAreaInsets();
  const deliveryId = route.params?.deliveryId;
  const deliveryLabel = route.params?.deliveryLabel;
  const send = useSendReviewRequest();
  const [topic, setTopic] = useState<ReviewTopic | null>(
    deliveryId ? 'PAY' : null,
  );
  const [note, setNote] = useState('');

  const trimmed = note.trim();
  const canSend = !!topic && trimmed.length > 0 && !send.isPending;

  // ScreenSafeArea pads the bottom only on iOS, so Android adds the inset itself (as RequestRemoval).
  const noteBoxInset = {
    paddingBottom: Platform.OS === 'android' ? bottom : 0,
  };

  const onSend = () => {
    if (!topic) {
      return;
    }
    send.mutate(
      { topic, note: trimmed, ...(deliveryId ? { deliveryId } : {}) },
      {
        // Say it went, and by when a person answers, so the rider does not send it again.
        onSuccess: sent => {
          const due = sent?.dueAt ? moment(sent.dueAt) : null;
          Alert.alert(
            t('translations:review_sent_title'),
            due
              ? t('translations:review_due', {
                  when: `${due.format(formatSpaced)}, ${due.format(
                    formatShift,
                  )}`,
                })
              : undefined,
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
          <Text
            style={styles.title}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {t('translations:review_title')}
          </Text>
          <BackNavButton onPress={() => navigation.goBack()} />
        </View>
        {/* Lifts the note above the keyboard on both systems (SDK 35, row 114). */}
        <KeyboardAvoidingView style={styles.keyboardArea} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              {deliveryLabel
                ? t('translations:review_intro_delivery', {
                    delivery: deliveryLabel,
                  })
                : t('translations:review_intro_general')}
            </Text>
            {TOPICS.map(item => {
              const isSelected = topic === item.topic;
              return (
                <TouchableOpacity
                  key={item.topic}
                  style={touchRow}
                  disabled={send.isPending}
                  onPress={() => setTopic(item.topic)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  testID={`review-topic-${item.topic}`}>
                  <View style={styles.row}>
                    <Icon
                      icon={isSelected ? CheckCircleIcon : CircleIcon}
                      weight={isSelected ? 'fill' : 'regular'}
                      size={20}
                      tone={isSelected ? 'success' : 'muted-foreground'}
                    />
                    <Text style={styles.rowLabel}>{t(item.label)}</Text>
                  </View>
                  <View style={styles.separator} />
                </TouchableOpacity>
              );
            })}
            <View style={[styles.noteBox, noteBoxInset]}>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={t('translations:review_note_placeholder')}
                multiline
                maxLength={REVIEW_NOTE_MAX_LENGTH}
                testID="review-note"
              />
              <Text style={styles.noteCount}>
                {`${note.length}/${REVIEW_NOTE_MAX_LENGTH}`}
              </Text>
              <Button
                type={ButtonType.redBGRedText}
                title={t('translations:review_send')}
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
