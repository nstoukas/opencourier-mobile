import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

const useUser = (enabled: boolean = true) => {
  const queryClient = useQueryClient();

  const {
    data: user,
    refetch,
    isLoading,
  } = useQuery({
    queryFn: services.userService.getUser,
    queryKey: [QueryKeys.user],
    enabled: enabled,
  });

  const { mutate: updateStatus } = useMutation({
    // Only the status is passed on: react-query also hands a mutation function
    // its own context object, which must not reach setUserStatus's options.
    mutationFn: (status: string) => services.userService.setUserStatus(status),
    onError: error => Alert.alert('Ooops', error.toString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.user] });
      refetch();
    },
  });

  const { mutate: updateDeliverySettings } = useMutation({
    mutationFn: services.userService.setDeliverySettings,
    onError: error => Alert.alert('Ooops', error.toString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.user] });
      refetch();
    },
  });

  const { mutate: updateUserLocation } = useMutation({
    mutationFn: services.userService.setUserLocation,
    onError: error => Alert.alert('Ooops', error.toString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.user] });
      refetch();
    },
  });

  return {
    user,
    isLoading,
    refetchUser: refetch,
    updateStatus,
    updateDeliverySettings,
    updateUserLocation,
  };
};

export default useUser;
