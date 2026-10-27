import { Colors } from '@app/styles/colors';
import { color } from '@app/styles/theme';
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
    fontSize: 26,
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
    fontSize: 16,
    marginTop: 39,
    marginBottom: 8,
  },
  buttonAddNote: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 4,
    backgroundColor: Colors.gray6,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  textAddNote: {
    fontSize: 14,
    fontWeight: '500',
    color: color['muted-foreground'],
    marginLeft: 4,
  },
  buttonConfirm: {
    marginBottom: 19,
  },
  buttonTextStyle: {
    fontSize: 16,
    fontWeight: '700',
  },
  textShow: {
    fontSize: 16,
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
    fontSize: 16,
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
    borderRadius: 8,
    width: 32,
    height: 32,
    backgroundColor: Colors.gray1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerText: {
    fontSize: 24,
    lineHeight: 24,
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
