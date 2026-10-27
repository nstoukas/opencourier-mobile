import React, { useState } from 'react';
import {
  View,
  Image,
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import axios from 'axios';
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

// The backend stores a note of 500 characters at most (decision 66.11).
const NOTE_MAX_LENGTH = 500;

export const ReportIssue = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top, bottom } = useSafeAreaInsets();
  const { order } = route.params;
  const [didSelectIssue, setDidSelectIssue] = useState<boolean>(false);
  // True while a report is on its way, so a second tap cannot send it twice.
  const [sending, setSending] = useState<boolean>(false);
  // Other opens a note field instead of sending at once (decision 66.16).
  const [writingNote, setWritingNote] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');

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
    {
      reason: DeliveryIssueReason.Other,
      label: t('translations:other'),
    },
  ];

  // Sends the report to the server, where the admin reads it (decision 66.11),
  // and thanks the rider only once it has arrived.
  const sendReport = async (reason: DeliveryIssueReason, withNote?: string) => {
    if (sending) {
      return;
    }
    setSending(true);
    try {
      await services.orderService.reportIssue({
        id: order.id,
        reason,
        note: withNote,
      });
      setDidSelectIssue(true);
    } catch (error) {
      // The message only: the whole error would print the rider's token in the log.
      console.log('Could not send the report', (error as Error)?.message);
      // With a response, the server got the report and refused it (404 when the
      // delivery is no longer this rider's), so retrying cannot help; without one,
      // it never arrived, which is usually the signal.
      const refused = axios.isAxiosError(error) && !!error.response;
      Alert.alert(
        t('translations:report_failed_title'),
        t(
          refused
            ? 'translations:report_refused_body'
            : 'translations:report_failed_body',
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: (typeof items)[number] }) => {
    // While a note is written, the other rows wait, so a mis-tap cannot send a
    // bare reason and throw the note away (decision 66.17).
    const waitsForNote =
      item.reason !== DeliveryIssueReason.Other && note.trim() !== '';
    return (
      <TouchableOpacity
        style={[touchRow, waitsForNote && styles.rowWaiting]}
        disabled={sending || waitsForNote}
        onPress={() =>
          item.reason === DeliveryIssueReason.Other
            ? setWritingNote(true)
            : sendReport(item.reason)
        }>
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

            {/* iOS has no adjustResize, so this lifts the note box above the keyboard
                (as in AddNote); Android resizes the window itself. */}
            <KeyboardAvoidingView
              style={styles.keyboardArea}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <FlatList
                keyExtractor={item => item.reason}
                data={items}
                renderItem={renderItem}
              />

              {/* A bare "Other" tells the admin nothing, so Send waits for a note. */}
              {writingNote && (
                // React Native's SafeAreaView pads the bottom only on iOS, so Android adds
                // the inset itself to keep Send report clear of the gesture bar.
                <View
                  style={[
                    styles.noteBox,
                    { paddingBottom: Platform.OS === 'android' ? bottom : 0 },
                  ]}>
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder={t('translations:report_note_placeholder')}
                    multiline
                    autoFocus
                    maxLength={NOTE_MAX_LENGTH}
                  />
                  <Text style={styles.noteCount}>
                    {`${note.length}/${NOTE_MAX_LENGTH}`}
                  </Text>
                  <Button
                    type={ButtonType.redBGRedText}
                    title={t('translations:report_send')}
                    disabled={sending || !note.trim()}
                    isLoading={sending}
                    onPress={() =>
                      sendReport(DeliveryIssueReason.Other, note.trim())
                    }
                  />
                </View>
              )}
            </KeyboardAvoidingView>
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
