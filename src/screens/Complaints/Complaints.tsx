import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { Colors } from '@app/styles/colors';
import { useComplaints, useReplyToComplaint } from '@app/hooks/useComplaints';
import { clearComplaintNotice } from '@app/services/complaintNotice';
import { Complaint } from '@app/types/types';
import {
  COMPLAINT_TEXT_MAX_LENGTH,
  complaintCategoryKey,
} from '@app/utilities/complaints';
import { coopClock, coopDate } from '@app/utilities/timeWorked';
import { styles } from './Complaints.styles';

type Props = DrawerScreenProp<DrawerScreens.Complaints>;

// Days and times are the co-op's (Europe/Athens), as on Earnings, never the phone's zone.
const day = (iso: string) =>
  moment(coopDate(Date.parse(iso)), 'YYYY-MM-DD').format('D MMM');
const dayAndTime = (iso: string) =>
  `${day(iso)}, ${coopClock(Date.parse(iso))}`;

// The first line of a card: who wrote it about whom. The filer of a complaint about the rider is only
// "the restaurant" or "the co-op", never an admin's name (AC-4): the server sends no name.
const kickerKey = (complaint: Complaint): string => {
  if (complaint.role === 'ABOUT_YOU') {
    return complaint.filedBy === 'RESTAURANT'
      ? 'translations:complaint_about_you_restaurant'
      : 'translations:complaint_about_you_coop';
  }
  return complaint.about === 'CUSTOMER'
    ? 'translations:complaint_yours_customer'
    : 'translations:complaint_yours_restaurant';
};

// AC-5: the reply box on a complaint about the rider that waits for their reply. The reply is stored
// once, so the rider confirms before it goes.
const ReplyBox = ({ complaint }: { complaint: Complaint }) => {
  const { t } = useTranslation();
  const reply = useReplyToComplaint();
  const [text, setText] = useState('');
  const trimmed = text.trim();

  const onSend = () => {
    Alert.alert(
      t('translations:complaint_reply_confirm_title'),
      t('translations:complaint_reply_confirm_body'),
      [
        { text: t('translations:cancel'), style: 'cancel' },
        {
          text: t('translations:complaint_reply_send'),
          onPress: () => reply.mutate({ id: complaint.id, text: trimmed }),
        },
      ],
    );
  };

  return (
    <>
      <TextInput
        style={styles.replyInput}
        value={text}
        onChangeText={setText}
        placeholder={t('translations:complaint_reply_placeholder')}
        multiline
        maxLength={COMPLAINT_TEXT_MAX_LENGTH}
        editable={!reply.isPending}
        testID={`complaint-reply-${complaint.id}`}
      />
      <Text style={styles.replyCount}>
        {`${text.length}/${COMPLAINT_TEXT_MAX_LENGTH}`}
      </Text>
      <Button
        type={ButtonType.redBGRedText}
        title={t('translations:complaint_reply_send')}
        disabled={trimmed.length === 0 || reply.isPending}
        isLoading={reply.isPending}
        onPress={onSend}
      />
    </>
  );
};

// One complaint: who and what, the job, the full words (AC-4), then the reply, the outcome or the
// withdrawal (AC-7). Nothing on it counts or ranks anything (value 5).
const ComplaintCard = ({ complaint }: { complaint: Complaint }) => {
  const { t } = useTranslation();
  const aboutYou = complaint.role === 'ABOUT_YOU';
  return (
    <View style={styles.card} testID={`complaint-${complaint.id}`}>
      <Text style={styles.cardKicker}>{t(kickerKey(complaint))}</Text>
      <Text style={styles.cardTitle}>
        {t(complaintCategoryKey(complaint.category), {
          defaultValue: t('translations:complaint_category_OTHER'),
        })}
      </Text>
      <Text style={styles.muted}>
        {t('translations:complaint_job_line', {
          restaurant: complaint.delivery.pickupName,
          day: day(complaint.delivery.createdAt),
        })}
      </Text>
      <Text style={styles.muted}>
        {t('translations:complaint_filed_on', {
          when: dayAndTime(complaint.createdAt),
        })}
      </Text>
      <Text style={styles.line}>{complaint.text}</Text>

      {complaint.riderReply !== null ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            {t('translations:complaint_your_reply')}
          </Text>
          <Text style={styles.line}>{complaint.riderReply}</Text>
          {complaint.replyEnteredForRider ? (
            <Text style={styles.muted}>
              {t('translations:complaint_reply_entered_for_you')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {complaint.status === 'AWAITING_REPLY' && aboutYou ? (
        <>
          <Text style={styles.needsReply}>
            {t('translations:complaint_needs_reply')}
          </Text>
          <ReplyBox complaint={complaint} />
        </>
      ) : null}

      {complaint.status === 'OPEN' ? (
        <Text style={[styles.muted, styles.line]}>
          {t(
            aboutYou
              ? 'translations:complaint_open_about_you'
              : 'translations:complaint_open_yours',
          )}
        </Text>
      ) : null}

      {complaint.status === 'DECIDED' ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            {t('translations:complaint_outcome')}
          </Text>
          {complaint.outcome ? (
            <Text style={styles.line}>{complaint.outcome}</Text>
          ) : null}
          {complaint.decidedAt ? (
            <Text style={styles.muted}>
              {t('translations:complaint_decided_on', {
                when: dayAndTime(complaint.decidedAt),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {complaint.status === 'WITHDRAWN' ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            {t(
              aboutYou
                ? 'translations:complaint_withdrawn_about_you'
                : 'translations:complaint_withdrawn',
            )}
          </Text>
          {complaint.withdrawnReason ? (
            <Text style={styles.line}>{complaint.withdrawnReason}</Text>
          ) : null}
          {complaint.withdrawnAt ? (
            <Text style={styles.muted}>
              {t('translations:complaint_decided_on', {
                when: dayAndTime(complaint.withdrawnAt),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

// Spec 0052 (AC-4, AC-5, AC-7; cross check 11): the complaints the rider filed and the ones about them,
// newest first, in the side menu. A complaint about the rider shows its full words and a reply box;
// every complaint shows its outcome once there is one. New complaints are filed from a job in Earnings.
export const Complaints = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const complaints = useComplaints();
  const all = complaints.data?.pages.flatMap(page => page.data) ?? [];
  // Only the rider's own pull shows the spinner; the refetch on each visit does not (as EarningsDelivery).
  const [pulling, setPulling] = useState(false);
  const onRefresh = () => {
    setPulling(true);
    complaints.refetch().finally(() => setPulling(false));
  };

  // Drawer screens stay mounted, so the list is read again each time the screen is shown (as Earnings),
  // and the notice in the shade goes: the rider is reading the complaints now.
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        clearComplaintNotice();
        complaints.refetch();
      }),
    // `complaints.refetch` keeps its identity; listening once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation],
  );

  const body = () => {
    if (complaints.isLoading) {
      return <ActivityIndicator />;
    }
    if (all.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {complaints.isError
              ? t('translations:complaint_list_failed')
              : t('translations:complaint_none')}
          </Text>
          <Text style={styles.muted}>
            {complaints.isError
              ? t('translations:earnings_pull_to_retry')
              : t('translations:complaint_none_body')}
          </Text>
        </View>
      );
    }
    return (
      <>
        {all.map(complaint => (
          <ComplaintCard key={complaint.id} complaint={complaint} />
        ))}
        {complaints.hasNextPage ? (
          <TouchableOpacity
            style={styles.more}
            onPress={() => complaints.fetchNextPage()}
            accessibilityRole="button">
            <Text style={styles.moreText}>{t('translations:show_older')}</Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.offlineGradientArray}
      />
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.toggleDrawer()} />
          <Text style={styles.title}>{t('translations:complaints')}</Text>
        </View>
        {/* Lifts a reply box above the keyboard on both systems (SDK 35, row 114). */}
        <KeyboardAvoidingView style={styles.keyboardArea} behavior="padding">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={pulling} onRefresh={onRefresh} />
            }>
            {body()}
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </View>
  );
};
