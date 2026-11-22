import { Alert } from 'react-native';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  InfiniteData,
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { services } from '@app/services/service';
import { FileComplaintInput } from '@app/services/complaintService';
import { Complaint, ComplaintPage } from '@app/types/types';
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

// The saved list holds this complaint with a reply already (the rider's own send, just stored).
const hasReplyInList = (queryClient: QueryClient, id: string): boolean => {
  const list = queryClient.getQueryData<InfiniteData<ComplaintPage>>([
    QueryKeys.complaints,
  ]);
  return !!list?.pages.some(page =>
    page.data.some(item => item.id === id && item.riderReply !== null),
  );
};

// Puts the server's answer in place of the complaint in the saved list, so the card shows the reply at
// once and the reply box goes, before the list is read again.
const putInList = (queryClient: QueryClient, updated: Complaint) => {
  queryClient.setQueryData<InfiniteData<ComplaintPage>>(
    [QueryKeys.complaints],
    list =>
      list && {
        ...list,
        pages: list.pages.map(page => ({
          ...page,
          data: page.data.map(item =>
            item.id === updated.id ? updated : item,
          ),
        })),
      },
  );
};

// AC-5: the rider replies once to a complaint about them. A 409 means it already has a reply or was
// closed meanwhile; the list is read again either way, so the card shows what the server holds.
// Review fix (row 83): a stored reply is shown at once and said ("Reply sent"), and a 409 that only
// follows the rider's own stored reply (a second tap) is not reported as "Not sent".
export const useReplyToComplaint = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      services.complaintService.replyToComplaint(id, text),
    onSuccess: updated => {
      putInList(queryClient, updated);
      Alert.alert(
        t('translations:complaint_reply_sent_title'),
        t('translations:complaint_reply_sent_body'),
      );
    },
    onError: (error, { id }) => {
      console.log('Could not send the reply', (error as Error)?.message);
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 409 &&
        hasReplyInList(queryClient, id)
      ) {
        return;
      }
      Alert.alert(
        t('translations:complaint_send_failed_title'),
        failureText(error, t, 'translations:complaint_reply_conflict'),
      );
    },
    // Returned, so the mutation stays pending (and the Send button disabled) until the list is fresh.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QueryKeys.complaints] }),
  });
};
