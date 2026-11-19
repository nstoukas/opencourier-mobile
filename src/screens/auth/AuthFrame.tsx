import React from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { Icon } from '@app/components/Icon/Icon';
import { authStyles } from './auth.styles';

type Props = {
  children: React.ReactNode;
  // Shown as a back arrow at the top when given (not on Login).
  onBack?: () => void;
};

// The frame of the three logged out screens (row 17, spec 0039). The keyboard
// padding is on for Android as well as iOS: the app draws edge to edge (SDK 35),
// so Android no longer makes room for the keyboard itself (AC-17, row 114).
export const AuthFrame = ({ children, onBack }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenSafeArea style={authStyles.safeArea}>
      <KeyboardAvoidingView style={authStyles.flex} enabled behavior="padding">
        {onBack && (
          <View style={authStyles.topBar}>
            <TouchableOpacity
              style={authStyles.backButton}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('translations:back')}>
              <Icon icon={ArrowLeftIcon} size={24} tone="foreground" />
            </TouchableOpacity>
          </View>
        )}
        <ScrollView
          style={authStyles.flex}
          contentContainerStyle={authStyles.content}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenSafeArea>
  );
};
