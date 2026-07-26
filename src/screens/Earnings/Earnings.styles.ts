import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray14,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 16,
  },
  containerEarnings: {
    borderRadius: 20,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  textEarned: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.black1,
  },
  textCount: {
    fontSize: 20,
    color: Colors.black1,
  },
  textBreakdown: {
    fontSize: 13,
    color: Colors.gray13,
    marginTop: 2,
  },
  earningsText: {
    flex: 1,
  },
  containerEmptyCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textEmptyCellTitle: {
    fontWeight: '700',
    color: Colors.black1,
  },
  textEmptyCellSubtitle: {
    color: Colors.black1,
    marginTop: 10,
    marginBottom: 22,
  },
  footer: {},
  buttonFooter: {
    marginBottom: 22,
  },
  footerSeparator: {
    height: 1,
    backgroundColor: Colors.gray1,
    marginBottom: 22,
  },
  topMargin: {
    marginTop: 22,
  },
  veticalMargin: {
    marginVertical: 22,
  },
  // Keeps the last card clear of the screen edge once the list scrolls.
  listContent: {
    paddingBottom: 24,
  },
});
