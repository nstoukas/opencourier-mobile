import { StyleSheet } from 'react-native';
import { Colors } from '@app/styles/colors';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: typeScale.h1.fontSize,
  },
  content: {
    paddingTop: 24,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: Colors.gray12,
  },
  chipSelected: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  chipText: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  noteInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: Colors.gray12,
    borderRadius: radius.md,
    padding: 12,
    textAlignVertical: 'top',
  },
});
