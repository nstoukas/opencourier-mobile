import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  textNotesHeader: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '400',
    color: Colors.black4,
  },
  notesDash: {
    height: 1,
    backgroundColor: Colors.gray9,
    flex: 1,
    marginLeft: 8,
  },
  containerInstructions: {
    marginTop: 4,
    overflow: 'hidden',
  },
  addNote: {
    borderRadius: radius.md,
    width: 32,
    height: 32,
    backgroundColor: Colors.gray1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
