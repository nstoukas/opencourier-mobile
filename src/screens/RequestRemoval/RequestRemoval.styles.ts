import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
  intro: {
    fontSize: typeScale.body.fontSize,
    color: color.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  // Fills the space under the header, so the note box sits at its bottom.
  keyboardArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  rowLabel: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
    color: color.foreground,
    flex: 1,
  },
  rowPaid: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    color: color.success,
  },
  rowNotPaid: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    color: color['muted-foreground'],
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray12,
  },
  noteBox: {
    marginTop: 16,
  },
  noteInput: {
    backgroundColor: Colors.gray1,
    minHeight: 80,
    borderRadius: radius.xl,
    padding: 10,
    fontSize: typeScale.body.fontSize,
    textAlignVertical: 'top',
  },
  noteCount: {
    fontSize: typeScale.caption.fontSize,
    color: Colors.gray12,
    textAlign: 'right',
    marginVertical: 6,
  },
  // A reason list that could not load, or is still loading.
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  centerText: {
    fontSize: typeScale.body.fontSize,
    color: color.foreground,
    textAlign: 'center',
  },
});
