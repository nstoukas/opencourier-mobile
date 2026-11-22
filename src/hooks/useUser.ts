import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import i18n from '@app/localization/i18n';
import { serverMessage } from '@app/hooks/useMoveDropoffPin';

// A failed change, in the rider's language: the server's refusal when it sent one, else a plain
// sentence (spec 0054; it showed "Ooops" and the developer's error text).
const alertFailure = (error: unknown) =>
  Alert.alert(
    i18n.t('translations:change_failed_title'),
    serverMessage(error) ?? i18n.t('translations:auth_error_other'),
  );

const useUser = (enabled: boolean = true) => {
  const queryClient = useQueryClient();

  const {
    data: user,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryFn: services.userService.getUser,
    queryKey: [QueryKeys.user],
    enabled: enabled,
  });

  const { mutate: updateStatus } = useMutation({
    // Only the status is passed on: react-query also hands a mutation function
    // its own context object, which must not reach setUserStatus's options.
    mutationFn: (status: string) => services.userService.setUserStatus(status),
    onError: alertFailure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.user] });
      refetch();
    },
  });

  const { mutate: updateDeliverySettings, isPending: isSavingDeliverySetting } =
    useMutation({
      mutationFn: services.userService.setDeliverySettings,
      onError: alertFailure,
      // Returning the reload's promise keeps the save pending until the rider is
      // read again (react-query waits for it), so `isSavingDeliverySetting` turns
      // false only once `user` already shows the saved value (row 84).
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: [QueryKeys.user] }),
          refetch(),
        ]),
    });

  return {
    user,
    isLoading,
    // True when loading the rider failed (and react-query's retries ran out).
    isUserError: isError,
    refetchUser: refetch,
    updateStatus,
    updateDeliverySettings,
    // True while an auto accept change is on its way (row 84).
    isSavingDeliverySetting,
  };
};

export default useUser;
