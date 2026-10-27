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
  container: {
    backgroundColor: Colors.white,
    borderRadius: radius['2xl'],
    padding: 28,
  },
  title: {
    fontWeight: '700',
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
    lineHeight: typeScale.body.lineHeight,
    marginBottom: 4,
  },
  subtitle: {
    fontWeight: '600',
    color: Colors.gray19,
    fontSize: typeScale['body-sm'].fontSize,
    lineHeight: typeScale['body-sm'].lineHeight,
    marginBottom: 16,
  },
  image: {
    width: 24,
    height: 24,
    marginRight: 16,
  },
  containerHorizontal: {
    flexDirection: 'row',
  },
});
