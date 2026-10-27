import React from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableOpacity,
} from 'react-native';
import { RootScreen, RootScreenProp } from '@app/navigation/types';
import { styles } from './DeleteNote.styles';
import { useTranslation } from 'react-i18next';
import { Button, ButtonType } from '@app/components/Button/Button';
import { typeScale } from '@app/styles/theme';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';

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
            hitSlop={hitSlopFor(40)}
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon icon={ArrowLeftIcon} weight="bold" size={20} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('translations:delete_prompt')}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.containerInfo}>
          <Icon
            icon={InfoIcon}
            weight="fill"
            size={14}
            tone="destructive"
            style={styles.iconinfo}
          />
          <Text style={styles.textInfo}>{t('translations:action_undone')}</Text>
        </View>
        <Button
          textStyle={{ fontWeight: '800', fontSize: typeScale.body.fontSize }}
          icon={TrashIcon}
          iconWeight="fill"
          type={ButtonType.red}
          title={t('translations:delete')}
          onPress={onDeletePress}
        />
      </KeyboardAvoidingView>
    </View>
  );
};
