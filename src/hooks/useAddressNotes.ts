import { useState } from 'react';
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

// Row 82 review: which sentence a failed note action shows. A 404 means the note (or the job) is
// gone, not that the connection failed; only a request with no answer at all is a connection problem.
export const noteFailureKey = (error: unknown, whenGone: string): string => {
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return whenGone;
  }
  if (axios.isAxiosError(error) && !error.response) {
    return 'translations:address_note_failed';
  }
  return 'translations:address_note_failed_server';
};

// Spec 0053 (AC-5, AC-7): upvote, flag and delete on the job card's rider notes. Each one reads the
// jobs again afterwards, success or not, so the counts and marks (or a note's absence) come from
// the server.
const useAddressNotes = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Row 82 review: the notes with an upvote or flag on its way, until the jobs are read again. A
  // second tap meanwhile is ignored, so a quick double tap cannot take the upvote straight back.
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const markBusy = (id: string) => setBusyIds(ids => [...ids, id]);
  const refreshThenFree = async (id: string) => {
    try {
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.inProgressOrders],
      });
    } finally {
      setBusyIds(ids => ids.filter(busy => busy !== id));
    }
  };
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [QueryKeys.inProgressOrders] });
  const failed = (error: unknown) =>
    Alert.alert(
      t('translations:address_note_failed_title'),
      t(noteFailureKey(error, 'translations:address_note_gone')),
    );

  // Each service is read when the mutation runs, not when Home first draws.
  const { mutate: upvote } = useMutation({
    mutationFn: (id: string) => services.commentService.toggleUpvote(id),
    onMutate: markBusy,
    onSettled: (_data, _error, id) => refreshThenFree(id),
    onError: failed,
  });

  const { mutate: flag } = useMutation({
    mutationFn: (params: { id: string; reason?: string }) =>
      services.commentService.flagComment(params),
    onMutate: params => markBusy(params.id),
    onSettled: (_data, _error, params) => refreshThenFree(params.id),
    onSuccess: () => {
      Alert.alert(
        t('translations:address_note_flagged_title'),
        t('translations:address_note_flagged'),
      );
    },
    onError: failed,
  });

  const { mutate: deleteNote } = useMutation({
    mutationFn: (id: string) => services.commentService.deleteComment(id),
    onSettled: refresh,
    onError: failed,
  });

  const isBusy = (id: string) => busyIds.includes(id);
  const toggleUpvote = (id: string) => {
    if (!isBusy(id)) {
      upvote(id);
    }
  };
  const flagNote = (params: { id: string; reason?: string }) => {
    if (!isBusy(params.id)) {
      flag(params);
    }
  };

  return { toggleUpvote, flagNote, deleteNote, isBusy };
};

export default useAddressNotes;
