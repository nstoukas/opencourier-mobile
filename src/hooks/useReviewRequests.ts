import { Alert } from 'react-native';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { services } from '@app/services/service';
import { SendReviewInput } from '@app/services/reviewService';
import { QueryKeys } from '@app/utilities/queryKeys';
import { serverMessage } from './useMoveDropoffPin';
import { currentLanguage } from '@app/localization/appLanguage';

// Spec 0038: the explanation page, the rider's review requests and what changed. None of these is
// saved to disk (`queryPersistence.ts` keeps only the keys it lists), so the page always shows the
// settings in effect when it opens (AC-11).

export const useHowItWorks = () =>
  useQuery({
    // The language is in the key, so switching it in Settings fetches the page again in that language (row 137).
    queryKey: [QueryKeys.howItWorks, currentLanguage()],
    queryFn: () => services.reviewService.getHowItWorks(currentLanguage()),
    // Fetched again each time the page opens: a representative may have changed a setting.
    staleTime: 0,
  });

// Pages of the rider's own requests, newest first (AC-8). `fetchNextPage` reads the next one.
export const useReviewRequests = () =>
  useInfiniteQuery({
    queryKey: [QueryKeys.reviewRequests],
    queryFn: ({ pageParam }) =>
      services.reviewService.getReviewRequests(pageParam),
    initialPageParam: 1,
    getNextPageParam: last => last.pagination?.nextPage ?? undefined,
  });

// Pages of "What changed" (AC-13), newest first.
export const useSettingChanges = () =>
  useInfiniteQuery({
    queryKey: [QueryKeys.settingChanges],
    queryFn: ({ pageParam }) =>
      services.reviewService.getSettingChanges(pageParam),
    initialPageParam: 1,
    getNextPageParam: last => last.pagination?.nextPage ?? undefined,
  });

// AC-1, AC-2. Online only: a request is not queued for later. A 409 (a request about this delivery is
// already open) gets the app's own sentence, since the server's names the request by its id; any other
// refusal shows the server's sentence.
export const useSendReviewRequest = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (input: SendReviewInput) =>
      services.reviewService.sendReviewRequest(input),
    onError: error => {
      // The message only: the whole error would print the rider's token, and the note.
      console.log(
        'Could not send the review request',
        (error as Error)?.message,
      );
      const answered = axios.isAxiosError(error) && !!error.response;
      const alreadyOpen =
        axios.isAxiosError(error) && error.response?.status === 409;
      const reason = serverMessage(error);
      Alert.alert(
        t('translations:review_send_failed_title'),
        !answered
          ? t('translations:review_send_no_connection')
          : alreadyOpen
          ? t('translations:review_send_already_open')
          : reason ?? t('translations:review_send_failed'),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.reviewRequests] });
    },
  });
};

// AC-8: the rider withdraws an open request, after a confirm.
export const useWithdrawReviewRequest = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: (id: string) =>
      services.reviewService.withdrawReviewRequest(id),
    onError: error => {
      console.log(
        'Could not withdraw the review request',
        (error as Error)?.message,
      );
      const answered = axios.isAxiosError(error) && !!error.response;
      Alert.alert(
        t('translations:review_withdraw_failed_title'),
        !answered
          ? t('translations:review_send_no_connection')
          : serverMessage(error) ?? t('translations:review_send_failed'),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.reviewRequests] });
    },
  });

  const confirmWithdraw = (id: string) => {
    Alert.alert(
      t('translations:review_withdraw_title'),
      t('translations:review_withdraw_body'),
      [
        { text: t('translations:review_withdraw_keep'), style: 'cancel' },
        {
          text: t('translations:review_withdraw_confirm'),
          onPress: () => mutation.mutate(id),
        },
      ],
    );
  };

  return { confirmWithdraw, isPending: mutation.isPending };
};
