import { Colors } from '@app/styles/colors';
import { color, radius, typeScale } from '@app/styles/theme';
import { Platform, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: typeScale.h2.fontSize,
  },
  gridContainer: {
    flex: 1,
    marginTop: 10,
  },
  contentContainerStyle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  textNote: {
    fontSize: typeScale.body.fontSize,
    marginTop: 39,
    marginBottom: 8,
  },
  buttonAddNote: {
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 4,
    backgroundColor: Colors.gray6,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  textAddNote: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '500',
    color: color['muted-foreground'],
    marginLeft: 4,
  },
  buttonConfirm: {
    marginBottom: 19,
  },
  buttonTextStyle: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
  },
  textShow: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
    marginBottom: 19,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingBottom: 12,
    paddingTop: 8,
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
  headerText: {
    fontSize: typeScale.h2.fontSize,
    lineHeight: typeScale.h2.lineHeight,
    color: Colors.gray21,
  },
  containerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingBottom: 16,
  },
  headerLine: {
    height: 1,
    backgroundColor: Colors.gray1,
    flex: 1,
  },
});
