import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { useShifts } from '@app/hooks/useShifts';
import { serverMessage } from '@app/hooks/useMoveDropoffPin';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import {
  BookingAction,
  MyShiftBooking,
  ShiftOccurrence,
  actOnBooking,
  bookShift,
} from '@app/services/shifts/shiftsApi';
import { QueryKeys } from '@app/utilities/queryKeys';
import { dayLabel } from '@app/utilities/shiftDays';
import { color, space, typeScale } from '@app/styles/theme';

type Props = DrawerScreenProp<DrawerScreens.Shifts>;

// What a button press asks the server for.
type ShiftRequest =
  | { kind: 'book'; occurrence: ShiftOccurrence }
  | { kind: BookingAction; bookingId: string };

// Spec 0027 (AC-10): the rider's shifts and the next 14 days. Every time on it is the server's Athens
// text. It shows places per shift ("2 places left"), never who booked or how many shifts anyone has
// (value 5). Every refusal shows the server's own sentence.
export const ShiftsScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isFetching, isLoading, refetch } = useShifts(true);
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (request: ShiftRequest) =>
      request.kind === 'book'
        ? bookShift(request.occurrence.shiftSlotId, request.occurrence.date)
        : actOnBooking(request.bookingId, request.kind),
    onSuccess: () => setMessage(null),
    onError: error =>
      setMessage(serverMessage(error) ?? t('translations:shift_action_failed')),
    // Read again either way: a refusal often means the schedule changed (a place filled, a swap taken).
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QueryKeys.shifts] }),
  });

  const run = (request: ShiftRequest) => {
    if (!mutation.isPending) {
      mutation.mutate(request);
    }
  };

  // Dropping is the one change a rider might regret, so it asks first.
  const confirmDrop = (booking: MyShiftBooking) =>
    Alert.alert(
      t('translations:shift_drop_confirm_title'),
      t('translations:shift_drop_confirm_body', {
        day: dayLabel(booking.date),
        start: booking.startTime,
        end: booking.endTime,
      }),
      [
        { text: t('translations:cancel'), style: 'cancel' },
        {
          text: t('translations:shift_drop'),
          style: 'destructive',
          onPress: () => run({ kind: 'drop', bookingId: booking.id }),
        },
      ],
    );

  const myBookings = data?.myBookings ?? [];
  const byDate = new Map<string, ShiftOccurrence[]>();
  for (const occurrence of data?.occurrences ?? []) {
    byDate.set(occurrence.date, [
      ...(byDate.get(occurrence.date) ?? []),
      occurrence,
    ]);
  }

  return (
    <View style={styles.container} testID="shifts-screen">
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.toggleDrawer()} />
          <Text style={styles.title}>{t('translations:shifts')}</Text>
        </View>
        {message ? (
          <Text
            style={styles.message}
            accessibilityRole="alert"
            testID="shift-message">
            {message}
          </Text>
        ) : null}
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
            />
          }>
          <Text style={styles.section}>{t('translations:shift_mine')}</Text>
          {myBookings.length === 0 ? (
            <Text style={styles.muted}>
              {t('translations:shift_none_booked')}
            </Text>
          ) : (
            myBookings.map(booking => (
              <View
                key={booking.id}
                style={styles.row}
                testID={`my-shift-${booking.id}`}>
                <Text style={styles.rowTitle}>
                  {dayLabel(booking.date)} · {booking.startTime}–
                  {booking.endTime}
                </Text>
                <Text style={styles.muted}>
                  {booking.swapOfferedAt
                    ? t('translations:shift_swap_offered')
                    : t('translations:shift_drop_until', {
                        until: booking.dropUntilText,
                      })}
                </Text>
                <View style={styles.actions}>
                  <Button
                    title={t('translations:shift_drop')}
                    type={ButtonType.grayBGRedText}
                    onPress={() => confirmDrop(booking)}
                    disabled={mutation.isPending}
                    style={styles.actionButton}
                  />
                  {booking.swapOfferedAt ? (
                    <Button
                      title={t('translations:shift_swap_withdraw')}
                      type={ButtonType.gray}
                      onPress={() =>
                        run({ kind: 'swap/withdraw', bookingId: booking.id })
                      }
                      disabled={mutation.isPending}
                      style={styles.actionButton}
                    />
                  ) : booking.slotRemoved ? null : (
                    <Button
                      title={t('translations:shift_swap_offer')}
                      type={ButtonType.gray}
                      onPress={() =>
                        run({ kind: 'swap', bookingId: booking.id })
                      }
                      disabled={mutation.isPending}
                      style={styles.actionButton}
                    />
                  )}
                </View>
              </View>
            ))
          )}

          <Text style={styles.section}>{t('translations:shift_schedule')}</Text>
          {byDate.size === 0 && !isLoading ? (
            <Text style={styles.muted}>
              {t('translations:shift_none_scheduled')}
            </Text>
          ) : null}
          {[...byDate.entries()].map(([date, occurrences]) => (
            <View key={date} style={styles.day}>
              <Text style={styles.dayTitle}>{dayLabel(date)}</Text>
              {occurrences.map(occurrence => {
                const free = occurrence.riderCap - occurrence.placesTaken;
                return (
                  <View
                    key={`${occurrence.shiftSlotId}:${date}`}
                    style={styles.row}
                    testID={`occurrence-${occurrence.shiftSlotId}-${date}`}>
                    <Text style={styles.rowTitle}>
                      {occurrence.startTime}–{occurrence.endTime}
                    </Text>
                    <Text style={styles.muted}>
                      {occurrence.myBookingId
                        ? t('translations:shift_booked')
                        : free > 0
                        ? t('translations:shift_places_left', { count: free })
                        : t('translations:shift_full')}
                    </Text>
                    <View style={styles.actions}>
                      {occurrence.myBookingId ? null : occurrence.openSwap ? (
                        <Button
                          title={t('translations:shift_swap_take')}
                          type={ButtonType.black}
                          onPress={() =>
                            run({
                              kind: 'take',
                              bookingId: occurrence.openSwap!.bookingId,
                            })
                          }
                          disabled={mutation.isPending}
                          style={styles.actionButton}
                        />
                      ) : free > 0 ? (
                        <Button
                          title={t('translations:shift_book')}
                          type={ButtonType.black}
                          onPress={() => run({ kind: 'book', occurrence })}
                          disabled={mutation.isPending}
                          style={styles.actionButton}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.background },
  safe: { flex: 1, marginHorizontal: space['4'] },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space['4'],
  },
  title: { ...typeScale.h1, color: color.foreground, marginLeft: space['4'] },
  message: { color: color.destructive, marginBottom: space['3'] },
  section: {
    ...typeScale.h3,
    color: color.foreground,
    marginTop: space['4'],
    marginBottom: space['2'],
  },
  day: { marginBottom: space['3'] },
  dayTitle: {
    fontWeight: '700',
    color: color.foreground,
    marginBottom: space['1'],
  },
  row: {
    paddingVertical: space['2'],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  rowTitle: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
    color: color.foreground,
  },
  muted: { color: color['muted-foreground'] },
  actions: { flexDirection: 'row', gap: space['2'], marginTop: space['2'] },
  // Each button takes its share of the row, so its label never gets cut.
  actionButton: { flex: 1 },
});
