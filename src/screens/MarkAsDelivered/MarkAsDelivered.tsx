import React, { ReactElement, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  SectionListData,
  SectionList,
} from 'react-native';
import { styles } from './MarkAsDelivered.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { QuickNote } from '@app/components/QuickNote/QuickNote';
import { CustomerNotes } from '@app/types/types';
import { Button, ButtonType } from '@app/components/Button/Button';
import { useTranslation } from 'react-i18next';
import { RootScreen } from '@app/navigation/types';
import useOrder from '@app/hooks/useOrder';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';

type Props = MainScreenProp<MainScreens.MarkAsDelivered>;

type SectionListItem = {
  notes: string[];
};

export const MarkAsDelivered = ({ navigation, route }: Props) => {
  const { t } = useTranslation();

  const { order } = route.params;
  const [data, setData] = useState<SectionListData<SectionListItem>[]>([
    {
      data: [
        {
          notes: [
            CustomerNotes.BellnotRung,
            CustomerNotes.DontBlockDoor,
            CustomerNotes.HandleWithCare,
            CustomerNotes.PreventLeaks,
          ],
        },
      ],
      title: t('translations:quick_note'),
    },
    { data: [{ notes: [] }], title: t('translations:add_note') },
  ]);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);

  // The tap is written to the outbox and sent when there is signal (spec
  // 0009); the rider goes straight back to their deliveries.
  const { markAsDelivered } = useOrder();

  const handleNotePress = (note: string) => {
    const found = selectedNotes.filter(obj => obj === note);
    if (found.length > 0) {
      const newData = selectedNotes.filter(obj => obj !== note);
      setSelectedNotes(newData);
    } else {
      setSelectedNotes([...selectedNotes, note]);
    }
  };

  const noteSelected = (item: string) => {
    return selectedNotes.filter(obj => obj === item).length > 0;
  };

  const addNote = (text: string | undefined) => {
    if (text) {
      var temp = [...data];
      const noteArray = data[1].data[0].notes.filter(obj => obj !== text);
      temp[1].data[0].notes = [...noteArray, text];
      setData(temp);
    }
  };

  const onAddNote = () => {
    navigation.navigate(RootScreen.AddNoteModal, {
      onNoteAdded: addNote,
      order: order,
    });
  };

  const renderItem = ({
    section,
  }: {
    index: number;
    section: SectionListData<SectionListItem>;
  }) => {
    const item = section.data[0];
    return (
      <View style={styles.contentContainerStyle}>
        {item &&
          item.notes &&
          item?.notes?.map(note => {
            return (
              <QuickNote
                // The notes in one section are different texts, so the text is its key.
                key={note}
                createdByUser={section.title === t('translations:add_note')}
                text={note}
                selected={noteSelected(note)}
                onPress={handleNotePress}
              />
            );
          })}
      </View>
    );
  };

  const renderSectionHeader = ({
    section: { title },
  }: {
    section: SectionListData<SectionListItem>;
  }): ReactElement => {
    if (title === t('translations:quick_note')) {
      return (
        <View style={styles.containerHeader}>
          <Text style={styles.textNotesHeader}>{title}</Text>
          <View style={styles.headerLine} />
        </View>
      );
    }
    return (
      <View style={[styles.noteHeader]}>
        <Text style={styles.textNotesHeader}>{t('translations:add_note')}</Text>
        <View style={styles.notesDash} />
        <TouchableOpacity
          hitSlop={hitSlopFor(32)}
          style={styles.addNote}
          onPress={() => onAddNote()}>
          <Icon icon={PlusIcon} size={14} />
        </TouchableOpacity>
      </View>
    );
  };

  const handleConfirm = async () => {
    const note = selectedNotes.length > 0 ? selectedNotes[0] : '';
    if (await markAsDelivered(order, note)) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <Text style={styles.title}>
            {t('translations:marking_as_delivered')}
          </Text>
          <BackNavButton onPress={() => navigation.goBack()} />
        </View>

        <SectionList
          showsVerticalScrollIndicator={false}
          style={[styles.gridContainer]}
          sections={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${index}`}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
        />

        <Button
          style={styles.buttonConfirm}
          textStyle={styles.buttonTextStyle}
          icon={CheckCircleIcon}
          iconWeight="fill"
          type={ButtonType.green}
          title={t('translations:confirm_mark_as_delivered')}
          onPress={handleConfirm}
        />

        <Button
          style={styles.buttonConfirm}
          textStyle={styles.buttonTextStyle}
          type={ButtonType.redBGRedText}
          title={t('translations:report_issue')}
          onPress={() => {
            navigation.navigate(MainScreens.ReportIssue, { order: order });
          }}
        />
      </SafeAreaView>
    </View>
  );
};
