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
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ButtonType } from '@app/components/Button/Button';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { services } from '@app/services/service';
import { styles } from './ReportProduct.styles';

type Props = MainScreenProp<MainScreens.ReportProduct>;
type Kind = 'WRONG_ITEM' | 'MISSING_ITEM';

const NOTE_MAX_LENGTH = 500;
const SOMETHING_ELSE = '__other__';

// Spec 0032: at the customer's door, what was wrong or missing. The server keeps the note on the
// report and out of the event; the item is free text if it is not on the order.
export const ReportProduct = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { order } = route.params;
  const names = (order.orderItems ?? []).map(item => item.name);
  const [kind, setKind] = useState<Kind>('WRONG_ITEM');
  const [item, setItem] = useState<string>(names[0] ?? SOMETHING_ELSE);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = item !== SOMETHING_ELSE || note.trim() !== '';

  const send = async () => {
    if (sending || !canSend) {
      return;
    }
    setSending(true);
    try {
      await services.orderService.reportProduct({
        id: order.id,
        kind,
        itemName: item === SOMETHING_ELSE ? undefined : item,
        note: note.trim() || undefined,
      });
      // Says it went, so the rider knows before the job screen comes back.
      Alert.alert(t('translations:thanks_for_report'), '', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      // The message only: the whole error would print the rider's token in the log.
      console.log('Could not send the report', (error as Error)?.message);
      const refused = axios.isAxiosError(error) && !!error.response;
      Alert.alert(
        t('translations:report_failed_title'),
        t(
          refused
            ? 'translations:report_product_refused_body'
            : 'translations:report_failed_body',
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenSafeArea style={styles.safe}>
      <View style={styles.navHeader}>
        <Text style={styles.title}>{t('translations:report_product')}</Text>
        <BackNavButton onPress={() => navigation.goBack()} />
      </View>
      {/* iOS has no adjustResize, so this lifts the note above the keyboard, as in ReportIssue. */}
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          // Android: ScreenSafeArea pads only iOS, so Send stays clear of the gesture bar.
          { paddingBottom: Platform.OS === 'android' ? bottom + 16 : 16 },
        ]}>
        <View style={styles.row}>
          {chip(t('translations:report_product_wrong'), kind === 'WRONG_ITEM', () => setKind('WRONG_ITEM'))}
          {chip(t('translations:report_product_missing'), kind === 'MISSING_ITEM', () => setKind('MISSING_ITEM'))}
        </View>
        <View style={styles.row}>
          {names.map(name => chip(name, item === name, () => setItem(name)))}
          {chip(t('translations:report_product_something_else'), item === SOMETHING_ELSE, () => setItem(SOMETHING_ELSE))}
        </View>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder={t('translations:report_note_placeholder')}
          multiline
          maxLength={NOTE_MAX_LENGTH}
        />
        <Button
          type={ButtonType.redBGRedText}
          title={t('translations:report_send')}
          disabled={sending || !canSend}
          isLoading={sending}
          onPress={send}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenSafeArea>
  );
};
