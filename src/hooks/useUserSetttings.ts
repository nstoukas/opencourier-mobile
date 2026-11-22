import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { useMutation, useQuery } from '@tanstack/react-query';
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

const useUserSettings = () => {
  const { data, isLoading, refetch } = useQuery({
    queryFn: services.userService.getUserSettings,
    queryKey: [QueryKeys.userSettings],
  });

  const { mutate, isPaused } = useMutation({
    mutationFn: services.userService.updateUserSettings,
    onSuccess: () => refetch(),
    onError: alertFailure,
  });

  return {
    settings: data,
    isLoading,
    isUpdating: isPaused,
    updateSettings: mutate,
  };
};

export default useUserSettings;
