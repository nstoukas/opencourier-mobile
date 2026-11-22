import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { Icon } from '@app/components/Icon/Icon';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { Colors } from '@app/styles/colors';
import { useFileComplaint } from '@app/hooks/useComplaints';
import { forgetPickedPhoto } from '@app/services/complaintPhotoFiles';
import {
  COMPLAINT_PHOTO_MAX_BYTES,
  ComplaintPhoto,
  FileComplaintInput,
} from '@app/services/complaintService';
import { ComplaintCategory } from '@app/types/types';
import { touchRow } from '@app/utilities/touch';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_TEXT_MAX_LENGTH,
  complaintCategoryKey,
} from '@app/utilities/complaints';
import { styles } from '../RequestRemoval/RequestRemoval.styles';
import { photoStyles } from './FileComplaint.styles';

type Props = MainScreenProp<MainScreens.FileComplaint>;

// Who a rider can complain about: the restaurant or the customer, never another rider (row 83).
type RiderAbout = FileComplaintInput['about'];
const ABOUT_CHOICES: { about: RiderAbout; label: string }[] = [
  { about: 'RESTAURANT', label: 'translations:complaint_about_restaurant' },
  { about: 'CUSTOMER', label: 'translations:complaint_about_customer' },
];

// One radio row, as on the review request screen.
const ChoiceRow = ({
  label,
  selected,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) => (
  <TouchableOpacity
    style={touchRow}
    disabled={disabled}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    testID={testID}>
    <View style={styles.row}>
      <Icon
        icon={selected ? CheckCircleIcon : CircleIcon}
        weight={selected ? 'fill' : 'regular'}
        size={20}
        tone={selected ? 'success' : 'muted-foreground'}
      />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <View style={styles.separator} />
  </TouchableOpacity>
);

// Spec 0052 (AC-2): the rider complains about the restaurant or the customer of one of their jobs,
// opened from the job in Earnings (its two month reach is the filing window, cross check 11). Only the
// co-op reads it: the restaurant is not told (cross check 5) and the customer is never contacted.
// Slice 2: one optional photo from the gallery. On Android the picker is the system Photo Picker, so the
// app needs no storage permission and sees only the photo the rider picks; there is no camera here
// (row 18 removed it). The picker hands back a JPEG at most 1600 px on a side at quality 0.8 (a PNG
// stays a PNG); the server checks it again and removes all metadata before keeping it.
export const FileComplaint = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top, bottom } = useSafeAreaInsets();
  const { deliveryId, deliveryLabel } = route.params;
  const send = useFileComplaint();
  const [about, setAbout] = useState<RiderAbout | null>(null);
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<ComplaintPhoto | null>(null);

  const trimmed = text.trim();
  const canSend =
    !!about && !!category && trimmed.length > 0 && !send.isPending;

  // ScreenSafeArea pads the bottom only on iOS, so Android adds the inset itself (as RequestReview).
  const textBoxInset = {
    paddingBottom: Platform.OS === 'android' ? bottom : 0,
  };

  const chooseAbout = (next: RiderAbout) => {
    // Each party has its own categories, so a category picked for the other one is cleared.
    if (next !== about) {
      setCategory(null);
    }
    setAbout(next);
  };

  // Row 83 review: the picker's copy of a photo leaves the phone once it is not needed. On leaving the
  // form without sending it goes here; after a filing the hook removes it. A ref (a value React keeps
  // between draws without drawing again) lets the cleanup read the latest photo and sending state.
  const latest = useRef({ photo, sending: send.isPending });
  latest.current = { photo, sending: send.isPending };
  useEffect(
    () => () => {
      if (!latest.current.sending) {
        forgetPickedPhoto(latest.current.photo?.uri);
      }
    },
    [],
  );

  const removePhoto = () => {
    forgetPickedPhoto(photo?.uri);
    setPhoto(null);
  };

  // Opens the gallery for one photo. Cancelling keeps what was there before.
  const pickPhoto = async () => {
    let result;
    try {
      result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        includeBase64: false,
        includeExtra: false,
      });
    } catch {
      // The library answers with an errorCode today; this only keeps a rejection off the button press.
      Alert.alert(t('translations:complaint_photo_failed'));
      return;
    }
    if (result.didCancel) {
      return;
    }
    const asset = result.assets?.[0];
    if (result.errorCode || !asset?.uri) {
      // The code only: an error message can carry a file path.
      console.log('Could not pick a complaint photo', result.errorCode);
      Alert.alert(t('translations:complaint_photo_failed'));
      return;
    }
    if (asset.fileSize && asset.fileSize > COMPLAINT_PHOTO_MAX_BYTES) {
      forgetPickedPhoto(asset.uri);
      Alert.alert(t('translations:complaint_photo_too_big'));
      return;
    }
    const isPng = asset.type === 'image/png';
    // The photo it replaces is not needed any more.
    forgetPickedPhoto(photo?.uri);
    setPhoto({
      uri: asset.uri,
      type: isPng ? 'image/png' : 'image/jpeg',
      name: isPng ? 'photo.png' : 'photo.jpg',
    });
  };

  const onSend = () => {
    if (!about || !category) {
      return;
    }
    send.mutate(
      { deliveryId, about, category, text: trimmed, photo },
      {
        // The hook says it went ("Sent"), even if the rider already left; this only closes the form.
        onSuccess: () => {
          navigation.goBack();
        },
      },
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
          <Text style={styles.title}>{t('translations:complaint_title')}</Text>
          <BackNavButton onPress={() => navigation.goBack()} />
        </View>
        {/* Lifts the text box above the keyboard on both systems (SDK 35, row 114). */}
        <KeyboardAvoidingView style={styles.keyboardArea} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              {t('translations:complaint_intro', { delivery: deliveryLabel })}
            </Text>
            {ABOUT_CHOICES.map(item => (
              <ChoiceRow
                key={item.about}
                label={t(item.label)}
                selected={about === item.about}
                disabled={send.isPending}
                onPress={() => chooseAbout(item.about)}
                testID={`complaint-about-${item.about}`}
              />
            ))}
            {about ? (
              <>
                <Text style={styles.intro}>
                  {t('translations:complaint_what_happened')}
                </Text>
                {COMPLAINT_CATEGORIES[about].map(code => (
                  <ChoiceRow
                    key={code}
                    label={t(complaintCategoryKey(code))}
                    selected={category === code}
                    disabled={send.isPending}
                    onPress={() => setCategory(code)}
                    testID={`complaint-category-${code}`}
                  />
                ))}
              </>
            ) : null}
            <View style={[styles.noteBox, textBoxInset]}>
              <TextInput
                style={styles.noteInput}
                value={text}
                onChangeText={setText}
                placeholder={t('translations:complaint_text_placeholder')}
                multiline
                maxLength={COMPLAINT_TEXT_MAX_LENGTH}
                testID="complaint-text"
              />
              <Text style={styles.noteCount}>
                {`${text.length}/${COMPLAINT_TEXT_MAX_LENGTH}`}
              </Text>
              <View style={photoStyles.photoArea}>
                {photo ? (
                  <View style={photoStyles.photoRow}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={photoStyles.thumb}
                      accessibilityIgnoresInvertColors
                      accessibilityLabel={t(
                        'translations:complaint_photo_attached',
                      )}
                      testID="complaint-photo-thumb"
                    />
                    <View style={photoStyles.photoActions}>
                      <TouchableOpacity
                        style={photoStyles.photoAction}
                        disabled={send.isPending}
                        onPress={pickPhoto}
                        accessibilityRole="button"
                        testID="complaint-photo-change">
                        <Text style={photoStyles.photoActionText}>
                          {t('translations:complaint_change_photo')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={photoStyles.photoAction}
                        disabled={send.isPending}
                        onPress={removePhoto}
                        accessibilityRole="button"
                        testID="complaint-photo-remove">
                        <Text style={photoStyles.photoActionText}>
                          {t('translations:complaint_remove_photo')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Button
                    type={ButtonType.grayBGBlackText}
                    title={t('translations:complaint_add_photo')}
                    icon={ImageIcon}
                    iconPosition="left"
                    disabled={send.isPending}
                    onPress={pickPhoto}
                  />
                )}
                <Text style={photoStyles.hint}>
                  {t('translations:complaint_photo_hint')}
                </Text>
              </View>
              {about ? (
                <Text style={styles.intro}>
                  {t(
                    about === 'CUSTOMER'
                      ? 'translations:complaint_only_coop_customer'
                      : 'translations:complaint_only_coop_restaurant',
                  )}
                </Text>
              ) : null}
              <Button
                type={ButtonType.redBGRedText}
                title={t('translations:complaint_send')}
                disabled={!canSend}
                isLoading={send.isPending}
                onPress={onSend}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </View>
  );
};
