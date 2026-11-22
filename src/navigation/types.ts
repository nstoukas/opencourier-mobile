import { NavigationProp, RouteProp } from '@react-navigation/native';
import { MainStackParamList } from './main/types';
import { Note, NoteStop, UserStatus } from '@app/types/types';

export enum RootScreen {
  Loading = 'Loading',
  // The logged out screens: the co-op's login and the reset by email (row 17).
  Auth = 'Auth',
  Main = 'Main',
  UserStatusModal = 'UserStatusModal',
  AddNoteModal = 'AddNoteModal',
  DeleteNoteModal = 'DeleteNoteModal',
  DatePickerScreen = 'DatePickerScreen',
  // The rider's SOS (spec 0022): a root screen, so it survives any navigation.
  Sos = 'Sos',
}

export type RootStackParamList = {
  Loading: undefined;
  Sos: undefined;
  Auth: undefined;
  Main: undefined;
  UserStatusModal: {
    status: UserStatus;
    onAccept: (status: UserStatus) => void;
    onCancel: () => void;
  };
  // Spec 0053: a new note on one stop of a job the rider holds, or an edit of the rider's own note.
  // The screen sends it itself (with the personal data warning) and goes back once it is saved.
  AddNoteModal: {
    deliveryId?: string;
    stop?: NoteStop;
    noteToEdit?: Note;
  };
  DeleteNoteModal: {
    note: Note;
    onNoteDeleted: (note: Note) => void;
  };
  DatePickerScreen: {
    startOrEndShift: 'start' | 'end';
    day:
      | 'Monday'
      | 'Tuesday'
      | 'Wednesday'
      | 'Thursday'
      | 'Friday'
      | 'Saturday'
      | 'Sunday';
    onSelect: (
      date: Date,
      shift: 'start' | 'end',
      day:
        | 'Monday'
        | 'Tuesday'
        | 'Wednesday'
        | 'Thursday'
        | 'Friday'
        | 'Saturday'
        | 'Sunday',
    ) => void;
  };
};

export type RootNavigationProp = NavigationProp<
  RootStackParamList & MainStackParamList
>;

export type RootRouteProp<T extends RootScreen> = RouteProp<
  RootStackParamList,
  T
>;

export type RootScreenProp<T extends RootScreen> = {
  navigation: RootNavigationProp;
  route: RootRouteProp<T>;
};
