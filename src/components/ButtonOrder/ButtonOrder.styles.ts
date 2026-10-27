import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    height: 56,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  textTitle: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 4,
  },
  containerLoader: {
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  progress: {
    backgroundColor: Colors.gray6,
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
  containerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
