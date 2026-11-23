import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  // As wide as the screen allows (less the 16 px each side), never wider.
  container: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    backgroundColor: Colors.white,
    borderRadius: radius['2xl'],
    padding: 24,
  },
  title: {
    fontWeight: '700',
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
    lineHeight: typeScale.body.lineHeight,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontWeight: '600',
    color: Colors.gray19,
    fontSize: typeScale['body-sm'].fontSize,
    lineHeight: typeScale['body-sm'].lineHeight,
    textAlign: 'center',
    marginBottom: 16,
  },
  image: {
    width: 24,
    height: 24,
    alignSelf: 'center',
    marginBottom: 12,
  },
});
