import axios from 'axios';
import { Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';

// Spec 0053 (AC-4): the code the server answers (with a 422) for a note that looks like it holds a
// name, phone or email and was sent without `confirmed: true`.
export const PERSONAL_DATA_WARNING_CODE = 'PERSONAL_DATA_WARNING';

// True for that 422. The server's error body looks like
// { error: true, result: [{ code, message, statusCode }] }.
export const isPersonalDataWarning = (error: unknown): boolean => {
  // `axios.isAxiosError` tells TypeScript that `error` has `response` below.
  if (!axios.isAxiosError(error) || error.response?.status !== 422) {
    return false;
  }
  const result = error.response.data?.result;
  return (
    Array.isArray(result) &&
    result.some(
      (item: { code?: string }) => item?.code === PERSONAL_DATA_WARNING_CODE,
    )
  );
};

// Spec 0053 (AC-5, AC-7): upvote, flag and delete on the job card's rider notes. Each one reads the
// jobs again afterwards, so the counts and marks come from the server.
const useAddressNotes = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [QueryKeys.inProgressOrders] });
  const failed = () =>
    Alert.alert(
      t('translations:address_note_failed_title'),
      t('translations:address_note_failed'),
    );

  const { mutate: toggleUpvote } = useMutation({
    mutationFn: services.commentService.toggleUpvote,
    onSuccess: refresh,
    onError: failed,
  });

  const { mutate: flagNote } = useMutation({
    mutationFn: services.commentService.flagComment,
    onSuccess: () => {
      refresh();
      Alert.alert(
        t('translations:address_note_flagged_title'),
        t('translations:address_note_flagged'),
      );
    },
    onError: failed,
  });

  const { mutate: deleteNote } = useMutation({
    mutationFn: services.commentService.deleteComment,
    onSuccess: refresh,
    onError: failed,
  });

  return { toggleUpvote, flagNote, deleteNote };
};

export default useAddressNotes;
