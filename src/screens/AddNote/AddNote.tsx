import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { RootScreen, RootScreenProp } from '@app/navigation/types';
import { styles } from './AddNote.styles';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ButtonType } from '@app/components/Button/Button';
import { ScrollView } from 'react-native-gesture-handler';
import { typeScale } from '@app/styles/theme';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { looksLikePersonalData } from '@app/utilities/addressNotes/personalDataCheck';
import {
  isPersonalDataWarning,
  noteFailureKey,
} from '@app/hooks/useAddressNotes';
import {
  hasSeenAddressNotesRules,
  markAddressNotesRulesSeen,
} from '@app/services/addressNotesRules';
import { AddressNotesRules } from '@app/components/AddressNotesRules/AddressNotesRules';
import { useJobContact } from '@app/hooks/useJobContact';

type Props = RootScreenProp<RootScreen.AddNoteModal>;

// The server's limit for a note (spec 0053, AC-2).
export const ADDRESS_NOTE_MAX_LENGTH = 255;

// Spec 0053: a rider's note about one stop of a job they hold (AC-2), or an edit of their own note.
// Before sending, the app checks the text for a name, phone or email and asks Edit or Save anyway
// (AC-4); the server checks again and answers 422 for a note sent without the confirmation. The
// first time a rider adds a note the rules notice comes first (AC-8).
export const AddNote = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { deliveryId, stop, noteToEdit } = route.params;
  const { data: contact } = useJobContact(false);
  const [note, setNote] = useState<string>(noteToEdit?.note ?? '');
  const [saving, setSaving] = useState(false);
  // null while the phone is still reading whether the rules were seen.
  const [showRules, setShowRules] = useState<boolean | null>(
    noteToEdit ? false : null,
  );

  useEffect(() => {
    if (noteToEdit) {
      return;
    }
    let cancelled = false;
    hasSeenAddressNotesRules().then(seen => {
      if (!cancelled) {
        setShowRules(!seen);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [noteToEdit]);

  const onRulesRead = () => {
    setShowRules(false);
    markAddressNotesRulesSeen().catch(() => undefined);
  };

  const send = async (confirmed: boolean) => {
    const text = note.trim();
    setSaving(true);
    try {
      if (noteToEdit) {
        await services.commentService.updateComment({
          id: noteToEdit.id,
          note: text,
          confirmed,
        });
      } else if (deliveryId && stop) {
        await services.commentService.createComment({
          deliveryId,
          stop,
          note: text,
          ...(confirmed ? { confirmed: true } : {}),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.inProgressOrders],
      });
      navigation.goBack();
    } catch (error) {
      if (isPersonalDataWarning(error)) {
        // The server's copy of the check found something this phone's did not (an older app).
        warn();
      } else {
        // Row 82 review: a 404 is a job handed back or a note deleted meanwhile, not a connection problem.
        const key = noteFailureKey(
          error,
          noteToEdit
            ? 'translations:address_note_gone'
            : 'translations:address_note_job_gone',
        );
        Alert.alert(
          t('translations:address_note_failed_title'),
          t(
            key === 'translations:address_note_failed'
              ? 'translations:address_note_save_failed'
              : key,
          ),
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // AC-4: Edit keeps the screen open; Save anyway sends it with the rider's confirmation.
  const warn = () =>
    Alert.alert(
      t('translations:address_note_warning_title'),
      t('translations:address_note_warning'),
      [
        { text: t('translations:address_note_warning_edit'), style: 'cancel' },
        {
          text: t('translations:address_note_warning_save'),
          onPress: () => {
            send(true).catch(() => undefined);
          },
        },
      ],
    );

  const onSave = () => {
    if (looksLikePersonalData(note)) {
      warn();
      return;
    }
    send(false).catch(() => undefined);
  };

  const canSave = note.trim().length > 0 && !saving;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Since SDK 35 Android draws edge to edge, so the keyboard needs padding there too. */}
        <KeyboardAvoidingView enabled behavior="padding">
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {showRules
                  ? t('translations:address_note_rules_title')
                  : noteToEdit
                  ? t('translations:address_note_title_edit')
                  : t('translations:address_note_title')}
              </Text>
              <TouchableOpacity
                hitSlop={hitSlopFor(40)}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel={t('translations:close')}
                onPress={() => navigation.goBack()}>
                <Icon icon={ArrowLeftIcon} weight="bold" size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.separator} />
            {showRules ? (
              <View style={styles.rules}>
                <AddressNotesRules
                  retentionDays={contact?.addressNoteRetentionDays}
                />
                <Button
                  type={ButtonType.green}
                  title={t('translations:address_note_rules_ok')}
                  onPress={onRulesRead}
                />
              </View>
            ) : showRules === false ? (
              <>
                <TextInput
                  style={styles.input}
                  value={note}
                  placeholder={t('translations:address_note_placeholder')}
                  onChangeText={setNote}
                  multiline
                  autoFocus
                  maxLength={ADDRESS_NOTE_MAX_LENGTH}
                  testID="address-note-input"
                />
                <View style={styles.containerInfo}>
                  <Icon
                    icon={InfoIcon}
                    weight="fill"
                    size={14}
                    style={styles.iconinfo}
                  />
                  <Text style={styles.textInfo}>
                    {`${note.length}/${ADDRESS_NOTE_MAX_LENGTH}`}
                  </Text>
                </View>
                <View style={styles.containerInfo}>
                  <Icon
                    icon={InfoIcon}
                    weight="fill"
                    size={14}
                    style={styles.iconinfo}
                  />
                  <Text style={[styles.textInfo, styles.hint]}>
                    {t('translations:address_note_hint')}
                  </Text>
                </View>
                <Button
                  textStyle={{
                    fontWeight: '800',
                    fontSize: typeScale.body.fontSize,
                  }}
                  icon={CheckCircleIcon}
                  iconWeight="fill"
                  type={ButtonType.green}
                  title={t('translations:save')}
                  isLoading={saving}
                  disabled={!canSave}
                  onPress={onSave}
                />
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
};
