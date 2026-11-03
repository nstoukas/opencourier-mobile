import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useJobContact } from '@app/hooks/useJobContact';
import { serverMessage } from '@app/hooks/useMoveDropoffPin';
import { fetchShifts } from '@app/services/shifts/shiftsApi';
import { syncShiftReminders } from '@app/services/shifts/shiftReminder';
import { QueryKeys } from '@app/utilities/queryKeys';

const TEN_MINUTES = 10 * 60_000;
export const SHIFTS_OFF_SENTENCE = 'Shifts are off.';

// Spec 0027: the shift schedule and this rider's bookings. It runs only while the co-op's switch (the
// last `config/contact` answer) says shifts are on, so a rider with shifts off never sees a 409. Read
// when Home or the Shifts screen opens, on return to the foreground, every ten minutes while in front
// and active (scoped by hand, as useJobContact does), and after each change. Saved to disk.
export const useShifts = (inFront: boolean = true) => {
  const { data: contact } = useJobContact(inFront);
  const shiftsOn = contact?.shiftsEnabled === true;
  const queryClient = useQueryClient();
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const query = useQuery({
    queryKey: [QueryKeys.shifts],
    queryFn: fetchShifts,
    enabled: shiftsOn,
    refetchInterval: shiftsOn && inFront && appActive ? TEN_MINUTES : false,
  });

  const { refetch, data, error } = query;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state === 'active' && shiftsOn) {
        void refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch, shiftsOn]);

  // The server says shifts were switched off: read the switch again, so the menu, the banner and the
  // reminders follow it now rather than within ten minutes.
  useEffect(() => {
    if (serverMessage(error) === SHIFTS_OFF_SENTENCE) {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.jobContact] });
    }
  }, [error, queryClient]);

  // The reminders follow the bookings; with shifts off there are none.
  useEffect(() => {
    if (!contact) {
      return;
    }
    void syncShiftReminders(
      shiftsOn ? data?.myBookings ?? [] : [],
      data?.clockOffsetMs ?? 0,
    ).catch(() => undefined);
  }, [contact, shiftsOn, data]);

  return { ...query, shiftsOn };
};
