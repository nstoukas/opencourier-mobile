import React from 'react';
import {
  StyleProp,
  ViewStyle,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { styles } from './InProgressNotes.styles';
import { CourierTip, Note, Order } from '@app/types/types';
import { PickupInstructionCell } from '../PickupInstructionsCell/PickupInstructionCell';
import { useNavigation } from '@react-navigation/native';
import { RootNavigationProp, RootScreen } from '@app/navigation/types';
import useComment from '@app/hooks/useComment';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';

type Props = {
  style?: StyleProp<ViewStyle>;
  order: Order;
  notes: Note[] | string[];
  headerTitle: string;
  type?: 'merchant' | 'location';
  expanded: boolean;
  noteCreationDisabled: boolean;
};

export const InProgressNotes = ({
  style,
  notes,
  order,
  headerTitle,
  type,
  expanded,
  noteCreationDisabled = true,
}: Props) => {
  const navigation = useNavigation<RootNavigationProp>();
  const { createComment } = useComment();

  const onNoteAdded = (
    text: string,
    type2: 'merchant' | 'location',
    noteOrder: Order,
  ) => {
    createComment({
      note: text,
      locationId:
        type === 'merchant'
          ? noteOrder.pickupLocationId
          : noteOrder.dropoffLocationId,
      deliveryId: noteOrder.id,
    });
  };

  const onNoteAdd = () => {
    navigation.navigate(RootScreen.AddNoteModal, {
      onNoteAdded: onNoteAdded,
      order: order,
      type: type,
    });
  };

  return (
    <View
      style={[
        styles.container,
        !expanded && { height: 0 },
        expanded && { overflow: 'visible' },
        style,
      ]}>
      <View style={[styles.noteHeader]}>
        <Text style={styles.textNotesHeader}>{headerTitle}</Text>
        <View style={styles.notesDash} />
        {!noteCreationDisabled && (
          <TouchableOpacity
            hitSlop={hitSlopFor(32)}
            style={styles.addNote}
            onPress={onNoteAdd}>
            <Icon icon={PlusIcon} size={14} />
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.containerInstructions]}>
        {notes?.map((note, index) => {
          // A saved note has its id; a plain text note is keyed by place and text.
          const key = typeof note === 'string' ? `${index}-${note}` : note.id;
          return <PickupInstructionCell key={key} note={note} />;
        })}
      </View>
    </View>
  );
};
