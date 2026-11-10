import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
import {
  useRemovalBusy,
  useRemovalReasons,
  useSendRemovalRequest,
} from '@app/hooks/useRemovalRequest';
import { RemovalReason } from '@app/types/types';
import { touchRow } from '@app/utilities/touch';
import { styles } from './RequestRemoval.styles';

type Props = MainScreenProp<MainScreens.RequestRemoval>;

// The backend stores a note of 500 characters at most (spec 0035, AC-3).
const NOTE_MAX_LENGTH = 500;

// Spec 0035 (AC-3): the rider picks a reason, seeing first whether it pays, adds a note and sends.
// The request changes nothing about the job until dispatch answers.
export const RequestRemoval = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top, bottom } = useSafeAreaInsets();
  const { order } = route.params;
  const reasons = useRemovalReasons();
  const { send } = useSendRemovalRequest();
  const sending = useRemovalBusy(order.id);
  const [selected, setSelected] = useState<RemovalReason | null>(null);
  const [note, setNote] = useState<string>('');

  const trimmed = note.trim();
  const canSend = !!selected && (!selected.needsNote || !!trimmed) && !sending;

  // ScreenSafeArea pads the bottom only on iOS, so Android adds the inset itself.
  const noteBoxInset = {
    paddingBottom: Platform.OS === 'android' ? bottom : 0,
  };

  const onSend = () => {
    if (!selected) {
      return;
    }
    send(
      {
        orderId: order.id,
        reasonId: selected.id,
        note: trimmed || undefined,
      },
      () => navigation.goBack(),
    );
  };

  const renderReason = ({ item }: { item: RemovalReason }) => {
    const isSelected = selected?.id === item.id;
    return (
      <TouchableOpacity
        style={touchRow}
        disabled={sending}
        onPress={() => setSelected(item)}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        testID={`removal-reason-${item.id}`}>
        <View style={styles.row}>
          <Icon
            icon={isSelected ? CheckCircleIcon : CircleIcon}
            weight={isSelected ? 'fill' : 'regular'}
            size={20}
            tone={isSelected ? 'success' : 'muted-foreground'}
          />
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={item.paid ? styles.rowPaid : styles.rowNotPaid}>
            {t(
              item.paid
                ? 'translations:removal_paid'
                : 'translations:removal_not_paid',
            )}
          </Text>
        </View>
        <View style={styles.separator} />
      </TouchableOpacity>
    );
  };

  const renderReasons = () => {
    if (reasons.data) {
      return (
        <FlatList
          style={styles.list}
          data={reasons.data}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={renderReason}
        />
      );
    }
    if (reasons.isError) {
      return (
        <View style={styles.center}>
          <Text style={styles.centerText}>
            {t('translations:removal_reasons_failed')}
          </Text>
          <Button
            type={ButtonType.gray}
            title={t('translations:removal_try_again')}
            onPress={() => reasons.refetch()}
          />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.onlineGradientArray}
      />
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <Text style={styles.title}>{t('translations:removal_title')}</Text>
          <BackNavButton onPress={() => navigation.goBack()} />
        </View>
        <Text style={styles.intro}>{t('translations:removal_intro')}</Text>

        {/* iOS has no adjustResize, so this lifts the note box above the keyboard
            (as in ReportIssue); Android resizes the window itself. */}
        <KeyboardAvoidingView
          style={styles.keyboardArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {renderReasons()}

          {selected && (
            <View style={[styles.noteBox, noteBoxInset]}>
              {/* `key` makes React draw a fresh box for each reason, so `autoFocus`
                  raises the keyboard when a note is needed. The text is kept in state. */}
              <TextInput
                key={selected.id}
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={t(
                  selected.needsNote
                    ? 'translations:removal_note_required'
                    : 'translations:removal_note_optional',
                )}
                multiline
                autoFocus={selected.needsNote}
                maxLength={NOTE_MAX_LENGTH}
                testID="removal-note"
              />
              <Text style={styles.noteCount}>
                {`${note.length}/${NOTE_MAX_LENGTH}`}
              </Text>
              <Button
                type={ButtonType.redBGRedText}
                title={t('translations:removal_send')}
                disabled={!canSend}
                isLoading={sending}
                onPress={onSend}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </View>
  );
};
