import { Alert } from 'react-native';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { services } from '@app/services/service';
import { FileComplaintInput } from '@app/services/complaintService';
import { QueryKeys } from '@app/utilities/queryKeys';
import { serverMessage } from './useMoveDropoffPin';

// Spec 0052 (row 83): the rider's complaints. Online only, like review requests: nothing is queued for
// later, and nothing is saved to disk (`queryPersistence.ts` keeps only the keys it lists).

// Pages of the complaints the rider filed and the ones about them, newest first (AC-4, AC-7).
export const useComplaints = () =>
  useInfiniteQuery({
    queryKey: [QueryKeys.complaints],
    queryFn: ({ pageParam }) =>
      services.complaintService.getComplaints(pageParam),
    initialPageParam: 1,
    getNextPageParam: last => last.pagination?.nextPage ?? undefined,
  });

// The words the rider sees when a send fails: no signal, the server's own sentence for a 400, or the
// app's sentence for the cases the app knows.
const failureText = (
  error: unknown,
  t: (key: string) => string,
  conflictKey: string,
): string => {
  if (!axios.isAxiosError(error) || !error.response) {
    return t('translations:complaint_no_connection');
  }
  if (error.response.status === 409) {
    return t(conflictKey);
  }
  if (error.response.status === 404) {
    return t('translations:complaint_not_found');
  }
  return serverMessage(error) ?? t('translations:complaint_send_failed');
};

// AC-2: the rider files about the restaurant or the customer of one of their jobs. A 409 means they
// already have an open complaint about that party on this job.
export const useFileComplaint = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (input: FileComplaintInput) =>
      services.complaintService.fileComplaint(input),
    onError: error => {
      // The message only: the whole error would print the rider's token, and the words.
      console.log('Could not file the complaint', (error as Error)?.message);
      Alert.alert(
        t('translations:complaint_send_failed_title'),
        failureText(error, t, 'translations:complaint_already_open'),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.complaints] });
    },
  });
};

// AC-5: the rider replies once to a complaint about them. A 409 means it already has a reply or was
// closed meanwhile; the list is read again either way, so the card shows what the server holds.
export const useReplyToComplaint = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      services.complaintService.replyToComplaint(id, text),
    onError: error => {
      console.log('Could not send the reply', (error as Error)?.message);
      Alert.alert(
        t('translations:complaint_send_failed_title'),
        failureText(error, t, 'translations:complaint_reply_conflict'),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.complaints] });
    },
  });
};
