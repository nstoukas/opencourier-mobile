import React, { useEffect, useState } from 'react';
import { Linking, Modal, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ButtonType } from '@app/components/Button/Button';
import { useCancelledJobs } from '@app/hooks/useCancelledJobs';
import {
  acknowledgeJob,
  cancelledByText,
  cancelledPayText,
  FoodOutcome,
  jobNeedingAttention,
  loadAcknowledged,
  sendFoodOutcome,
} from '@app/services/cancelledJobs/cancelledJobs';
import { telUrl } from '@app/utilities/jobContact';
import { QueryKeys } from '@app/utilities/queryKeys';
import { PhoneOutgoingIcon } from 'phosphor-react-native/src/icons/PhoneOutgoing';
import { styles } from './CancelledJobCard.styles';

// The longest note the server takes (spec 0015, AC-8).
const NOTE_MAX = 500;

type Props = {
  // Whether Home is the screen in front (its useIsFocused): the list polls only then.
  inFront?: boolean;
};

// Spec 0015, AC-7 and AC-8. Covers the whole screen while a cancelled job still needs the rider:
// the pay, who cancelled, and what to do with the food. After a pickup it stays until the rider
// says what happened to the food; before a pickup, until they tap OK. Nothing about the customer.
export const CancelledJobCard = ({ inFront = true }: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: jobs } = useCancelledJobs(inFront);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [writingNote, setWritingNote] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    loadAcknowledged()
      .then(setAcknowledged)
      .catch(() => undefined);
  }, []);

  const job = jobNeedingAttention(jobs, acknowledged);

  // A new job starts with a clean form.
  useEffect(() => {
    setWritingNote(false);
    setNote('');
    setErrorText(null);
  }, [job?.id]);

  if (!job) {
    return null;
  }

  const recordOutcome = async (outcome: FoodOutcome) => {
    setSending(true);
    setErrorText(null);
    try {
      await sendFoodOutcome(
        job.id,
        outcome,
        outcome === 'NOT_RETURNED' ? note.trim() : undefined,
      );
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.cancelledJobs],
      });
    } catch (error: any) {
      // 409: already recorded (another phone, or a tap that reached the server twice): just refresh.
      if (error?.response?.status === 409) {
        await queryClient.invalidateQueries({
          queryKey: [QueryKeys.cancelledJobs],
        });
      } else {
        setErrorText(t('translations:cancelled_send_failed'));
      }
    } finally {
      setSending(false);
    }
  };

  const acknowledge = async () => {
    await acknowledgeJob(job.id).catch(() => undefined);
    setAcknowledged(previous => new Set(previous).add(job.id));
  };

  const restaurant = job.pickupBusinessName || job.pickupName;

  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.screen} testID="cancelled-job-card">
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerTitle}>
            {t('translations:cancelled_title')}
          </Text>
          <Text style={styles.bannerText}>
            {t('translations:cancelled_body', {
              restaurant,
              by: cancelledByText(job.cancelledBy),
            })}
          </Text>
        </View>

        <Text style={styles.pay}>{cancelledPayText(job)}</Text>

        <Text style={styles.instructionTitle}>
          {t('translations:cancelled_food_title')}
        </Text>
        {job.pickedUp ? (
          <>
            <Text style={styles.instruction}>
              {t('translations:cancelled_food_return', { restaurant })}
            </Text>
            <Text style={styles.address}>{job.pickupAddress}</Text>
          </>
        ) : (
          <Text style={[styles.instruction, styles.address]}>
            {t('translations:cancelled_food_none')}
          </Text>
        )}

        {job.pickupPhoneNumber ? (
          <Button
            style={styles.button}
            type={ButtonType.white}
            icon={PhoneOutgoingIcon}
            iconWeight="fill"
            title={t('translations:call_restaurant')}
            onPress={() =>
              Linking.openURL(telUrl(job.pickupPhoneNumber)).catch(
                () => undefined,
              )
            }
          />
        ) : null}

        {job.pickedUp && !writingNote ? (
          <>
            <Button
              style={styles.button}
              type={ButtonType.green}
              title={t('translations:cancelled_food_returned')}
              disabled={sending}
              isLoading={sending}
              onPress={() => recordOutcome('RETURNED')}
            />
            <Button
              style={styles.button}
              type={ButtonType.gray}
              title={t('translations:cancelled_food_not_returned')}
              disabled={sending}
              onPress={() => setWritingNote(true)}
            />
          </>
        ) : null}

        {job.pickedUp && writingNote ? (
          <>
            <TextInput
              style={styles.noteInput}
              multiline
              maxLength={NOTE_MAX}
              value={note}
              onChangeText={setNote}
              placeholder={t('translations:cancelled_note_placeholder')}
              accessibilityLabel={t('translations:cancelled_note_placeholder')}
            />
            <Button
              style={styles.button}
              type={ButtonType.black}
              title={t('translations:cancelled_note_send')}
              disabled={sending || note.trim() === ''}
              isLoading={sending}
              onPress={() => recordOutcome('NOT_RETURNED')}
            />
            <Button
              style={styles.button}
              type={ButtonType.white}
              title={t('translations:cancelled_back')}
              disabled={sending}
              onPress={() => setWritingNote(false)}
            />
          </>
        ) : null}

        {!job.pickedUp ? (
          <Button
            style={styles.button}
            type={ButtonType.black}
            title={t('translations:cancelled_ok')}
            onPress={acknowledge}
          />
        ) : null}

        {errorText ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorText}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
};
