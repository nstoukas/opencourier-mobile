import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  containerLeft: {
    borderWidth: 1,
    borderColor: Colors.gray4,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  containerMiddle: {
    borderWidth: 1,
    borderColor: Colors.gray4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerRight: {
    borderWidth: 1,
    borderColor: Colors.gray4,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '500',
    color: Colors.gray3,
    margin: 10,
  },
});
