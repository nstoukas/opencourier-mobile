import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  OutgoingChat,
  useChatMessages,
  useChatQuickReplies,
  useChatSender,
} from '@app/hooks/useChat';
import { useConnectionStatus } from '@app/services/socket';
import type { ChatMessage } from '@app/services/chat/chatService';
import { markChatSeen } from '@app/services/chat/chatSeen';
import { clearChatNotice } from '@app/services/chat/chatNotice';
import { dropStoredOutgoing } from '@app/services/chat/chatOutgoing';
import { formatShift } from '@app/utilities/dates';
import { styles } from './Chat.styles';

type Props = MainScreenProp<MainScreens.Chat>;

type Row =
  | { kind: 'message'; key: string; message: ChatMessage }
  | { kind: 'outgoing'; key: string; item: OutgoingChat };

// Spec 0034 (chat), AC-12: the rider's one conversation with dispatch. Opened from a job (its messages
// are tagged with that delivery) or from the side menu (no tag). Presets first and typing second, so
// help is one tap away (AC-13). Nothing here tells dispatch whether the rider read anything (AC-6).
export const Chat = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const deliveryId = route.params?.deliveryId ?? null;
  const orderReference = route.params?.orderReference ?? null;
  const focused = useIsFocused();
  // Focus stays true while the app is in the background or the phone is locked, so the screen also
  // follows `AppState` (the app in front or not), as useDispatchState does. No TanStack focus manager
  // is wired to AppState here (review of 2026-11-18).
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const onScreen = focused && appActive;
  const connection = useConnectionStatus();
  // AC-8: with no live connection (Offline with no job, or no signal) the open screen polls, only
  // while it is really on screen.
  const messages = useChatMessages({
    poll: onScreen && connection !== 'connected',
  });
  const quickReplies = useChatQuickReplies();
  const { outgoing, send, retry } = useChatSender();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<Row>>(null);
  // The height of all the rows together, and of the box they scroll in, as last laid out.
  const contentHeight = useRef(0);
  const listHeight = useRef(0);
  // Shows the newest row whole, just above the presets and the box. FlatList's own scrollToEnd guesses
  // where the last row ends from rows it has measured, so a row it has not measured yet (a new
  // message, the send just made) left it about one row short (verify run, 2026-11-18). These two
  // heights are the real ones, so the bottom is exact.
  const showNewest = () =>
    listRef.current?.scrollToOffset({
      offset: Math.max(0, contentHeight.current - listHeight.current),
      animated: false,
    });

  // Back in front: fetch once, so what is marked seen below is what is really on screen now.
  const { refetch } = messages;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state === 'active') {
        refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch]);

  // AC-12: what is on screen is seen, on this phone only. The notice in the shade goes too. Never in
  // the background: a message that arrives then has not been seen.
  useEffect(() => {
    if (onScreen && messages.data) {
      markChatSeen(messages.data).catch(() => undefined);
      clearChatNotice();
    }
  }, [onScreen, messages.data]);

  // A send whose answer was lost is in the server's list already: it is no longer outgoing.
  useEffect(() => {
    dropStoredOutgoing(messages.data);
  }, [messages.data]);

  const rows = useMemo<Row[]>(() => {
    // Matched by the id the phone gave each message, so the same message never shows twice.
    const stored = new Set(
      (messages.data ?? []).map(message => message.clientMessageId),
    );
    return [
      ...(messages.data ?? []).map(message => ({
        kind: 'message' as const,
        key: message.id,
        message,
      })),
      ...outgoing
        .filter(item => !stored.has(item.clientMessageId))
        .map(item => ({
          kind: 'outgoing' as const,
          key: item.clientMessageId,
          item,
        })),
    ];
  }, [messages.data, outgoing]);

  // ScreenSafeArea pads the bottom only on iOS, so Android adds the inset itself.
  const composerInset = {
    paddingBottom: Platform.OS === 'android' ? bottom : 0,
  };
  const canSend = text.trim().length > 0;

  const onSend = () => {
    if (send(text, deliveryId)) {
      setText('');
    }
  };

  const meta = (message: ChatMessage): string => {
    const time = moment(message.createdAt).format(formatShift);
    const order = message.orderReference ? ` · #${message.orderReference}` : '';
    if (message.senderKind === 'DISPATCH') {
      return `${
        message.senderName ?? t('translations:chat_dispatch')
      } · ${time}${order}`;
    }
    const read = message.readByDispatch
      ? ` · ${t('translations:chat_read')}`
      : '';
    return `${time}${order}${read}`;
  };

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'outgoing') {
      const { item } = row;
      return (
        <View style={styles.mineRow}>
          <View style={[styles.mineBubble, styles.mineSending]}>
            <Text style={styles.mineText}>{item.body}</Text>
          </View>
          {item.state === 'failed' ? (
            <>
              {/* A refusal (a 4xx) says why in the server's own words. */}
              {item.refusal ? (
                <Text style={styles.meta}>{item.refusal}</Text>
              ) : null}
              <TouchableOpacity
                onPress={() => retry(item)}
                accessibilityRole="button"
                testID={`chat-retry-${item.clientMessageId}`}>
                <Text style={styles.failed}>
                  {t(
                    item.tagDropped
                      ? 'translations:chat_retry_untagged'
                      : 'translations:chat_not_sent',
                  )}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.meta}>{t('translations:chat_sending')}</Text>
          )}
        </View>
      );
    }
    const { message } = row;
    if (message.senderKind === 'SYSTEM') {
      return (
        <View style={styles.systemRow}>
          <View style={styles.systemBubble}>
            <Text style={styles.systemText}>
              {`${moment(message.createdAt).format(formatShift)} · ${
                message.body
              }`}
            </Text>
          </View>
        </View>
      );
    }
    const mine = message.senderKind === 'COURIER';
    return (
      <View
        style={mine ? styles.mineRow : styles.theirsRow}
        testID={`chat-message-${message.id}`}>
        <View style={mine ? styles.mineBubble : styles.theirsBubble}>
          <Text style={mine ? styles.mineText : styles.theirsText}>
            {message.body}
          </Text>
        </View>
        <Text style={styles.meta}>{meta(message)}</Text>
      </View>
    );
  };

  const renderBody = () => {
    if (messages.data) {
      return (
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={rows}
          keyExtractor={row => row.key}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          // The rows changed height: a message came, was sent or drew.
          onContentSizeChange={(_width, height) => {
            contentHeight.current = height;
            showNewest();
          }}
          // The box changed height: the presets appeared or the keyboard opened or closed.
          onLayout={event => {
            listHeight.current = event.nativeEvent.layout.height;
            showNewest();
          }}
          ListEmptyComponent={
            <Text style={styles.centerText}>
              {t('translations:chat_empty')}
            </Text>
          }
        />
      );
    }
    if (messages.isError) {
      return (
        <View style={styles.center}>
          <Text style={styles.centerText}>
            {t('translations:chat_load_failed')}
          </Text>
          <Button
            type={ButtonType.gray}
            title={t('translations:removal_try_again')}
            onPress={() => messages.refetch()}
          />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <Text style={styles.title}>{t('translations:chat_dispatch')}</Text>
          <BackNavButton onPress={() => navigation.goBack()} />
        </View>
        {orderReference ? (
          <Text style={styles.about}>
            {t('translations:chat_about_order', {
              order: `#${orderReference}`,
            })}
          </Text>
        ) : null}

        {/* Lifts the presets and the box above the keyboard, on both systems. iOS never resizes the
            screen for the keyboard, and from Android 15 (the app targets SDK 35) apps draw edge to edge
            and adjustResize no longer does either: the keyboard covered the box (verify run,
            2026-11-18). It pads only by how much the keyboard overlaps it, so where Android still
            resizes the screen it adds nothing (reasoned, not yet seen on a phone before Android 15). */}
        <KeyboardAvoidingView style={styles.keyboardArea} behavior="padding">
          {renderBody()}

          <View style={[styles.composer, composerInset]}>
            {(quickReplies.data?.length ?? 0) > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.presets}>
                {quickReplies.data?.map((reply, index) => (
                  // AC-13: one tap sends it, tagged like a typed message. The index keeps two equal
                  // presets in the co-op's list apart.
                  <TouchableOpacity
                    key={`${index}-${reply}`}
                    style={styles.preset}
                    onPress={() => send(reply, deliveryId)}
                    accessibilityRole="button"
                    testID={`chat-preset-${reply}`}>
                    <Text style={styles.presetText}>{reply}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={t('translations:chat_placeholder')}
                multiline
                maxLength={CHAT_MESSAGE_MAX_LENGTH}
                testID="chat-input"
              />
              <Button
                type={ButtonType.black}
                title={t('translations:chat_send')}
                disabled={!canSend}
                onPress={onSend}
                style={styles.send}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </View>
  );
};
