import React from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { RootScreen, RootScreenProp } from '@app/navigation/types';
import { styles } from './DeleteNote.styles';
import { useTranslation } from 'react-i18next';
import { Button, ButtonType } from '@app/components/Button/Button';
import { Images } from '@app/utilities/images';
import { typeScale } from '@app/styles/theme';

type Props = RootScreenProp<RootScreen.DeleteNoteModal>;

export const DeleteNote = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { note, onNoteDeleted } = route.params;

  const onDeletePress = () => {
    onNoteDeleted && onNoteDeleted(note);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Image source={Images.ArrowLeft} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('translations:delete_prompt')}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.containerInfo}>
          <Image source={Images.Info} style={styles.iconinfo} />
          <Text style={styles.textInfo}>{t('translations:action_undone')}</Text>
        </View>
        <Button
          textStyle={{ fontWeight: '800', fontSize: typeScale.body.fontSize }}
          icon={Images.Trash}
          type={ButtonType.red}
          title={t('translations:delete')}
          onPress={onDeletePress}
        />
      </KeyboardAvoidingView>
    </View>
  );
};
