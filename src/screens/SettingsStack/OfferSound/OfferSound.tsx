import React, { useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import notifee from '@notifee/react-native';
import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { SpeakerHighIcon } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { MusicNotesIcon } from 'phosphor-react-native/src/icons/MusicNotes';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import {
  getRingerState,
  isPhoneSilenced,
  openSoundSettings,
  playOfferSound,
} from '@app/services/offerPush/phone';
import { ensureOfferChannels } from '@app/services/offerPush/offerAlert';
import { styles } from './OfferSound.styles';

type Props = MainScreenProp<MainScreens.OfferSound>;

// Row 84: offer sound and volume. Android, not the app, keeps both: an offer
// rings on the "New offers" and "Offers still waiting" alert kinds (channels),
// with the co-op's own ring unless the rider picks another sound there, at the
// phone's notification volume. So this screen saves nothing of its own: it
// plays the ring, and opens the two phone settings where the rider changes it.
// The ring the app plays itself (an offer arriving with the app open, and the
// Play button here) reads the "New offers" sound too (OfferAlertModule.kt), so
// a sound picked there is the sound the rider hears everywhere.
// (The upstream Default sound and Volume screens offered choices that saved
// nothing and rang nothing; they are gone.)
export const OfferSound = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const isAndroid = Platform.OS === 'android';
  // Set when Play found the phone on silent, vibrate or Do Not Disturb: the
  // ring would not play, so say why instead of playing nothing.
  const [silenced, setSilenced] = useState(false);
  // Set when Play found that the rider chose None as the offer sound.
  const [noSound, setNoSound] = useState(false);

  const play = async () => {
    const isSilenced = isPhoneSilenced(await getRingerState());
    setSilenced(isSilenced);
    setNoSound(false);
    if (!isSilenced) {
      setNoSound((await playOfferSound()) === 'no_sound');
    }
  };

  const openVolume = () => {
    if (isAndroid) {
      openSoundSettings();
    } else {
      Linking.openSettings().catch(() => undefined);
    }
  };

  const openSoundChoice = async () => {
    try {
      // The alert kinds must exist before Android can list them.
      await ensureOfferChannels();
      // The app's page of alert kinds, where both offer kinds are listed.
      await notifee.openNotificationSettings();
    } catch {
      Linking.openSettings().catch(() => undefined);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title} accessibilityRole="header">
            {t('translations:offer_sound')}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.explained}>
            {t('translations:offer_sound_explained')}
          </Text>
          {isAndroid ? (
            <>
              <Button
                style={styles.button}
                type={ButtonType.black}
                icon={PlayIcon}
                iconWeight="fill"
                title={t('translations:offer_sound_play')}
                onPress={play}
              />
              {silenced ? (
                <Text style={styles.note} accessibilityLiveRegion="polite">
                  {t('translations:offer_sound_silenced')}
                </Text>
              ) : null}
              {noSound ? (
                <Text style={styles.note} accessibilityLiveRegion="polite">
                  {t('translations:offer_sound_none', {
                    offers: t('translations:offer_alert_channel'),
                  })}
                </Text>
              ) : null}
            </>
          ) : null}
          <Button
            style={styles.button}
            type={ButtonType.white}
            icon={SpeakerHighIcon}
            title={t('translations:offer_sound_volume')}
            onPress={openVolume}
          />
          {isAndroid ? (
            <>
              <Button
                style={styles.button}
                type={ButtonType.white}
                icon={MusicNotesIcon}
                title={t('translations:offer_sound_change')}
                onPress={openSoundChoice}
              />
              <Text style={styles.explained}>
                {t('translations:offer_sound_change_explained', {
                  offers: t('translations:offer_alert_channel'),
                  waiting: t('translations:offer_alert_channel_insistent'),
                })}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};
