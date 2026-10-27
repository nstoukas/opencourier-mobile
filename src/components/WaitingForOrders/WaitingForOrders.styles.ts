import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    backgroundColor: Colors.green3,
    borderColor: Colors.green1,
    marginHorizontal: 16,
    borderRadius: radius.sm,
    justifyContent: 'center',
    paddingVertical: 6,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerLoader: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: Colors.white,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
  },
});
