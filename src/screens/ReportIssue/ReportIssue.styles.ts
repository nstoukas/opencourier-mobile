import { Colors } from '@app/styles/colors';
import { Platform, StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

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
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: typeScale.h1.fontSize,
  },
  subtitle: {
    fontSize: typeScale.h3.fontSize,
    textAlign: 'center',
    marginVertical: 22,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray12,
  },
  cellHorizonal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 38,
  },
  cellText: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    flex: 1,
  },
  contentReported: {
    flex: 1,
    alignItems: 'center',
  },
  textThanks: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    textAlign: 'center',
  },
  textErrors: {
    fontSize: typeScale.body.fontSize,
    textAlign: 'center',
    marginVertical: 10,
  },
});
