import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    justifyContent: 'center',
  },
  containerImage: {
    width: 93,
    height: 93,
  },
  image: {
    width: 93,
    height: 93,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: Colors.gray13,
  },
  containerHorizontal: {
    flexDirection: 'row',
    height: 35,
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 8,
  },
  containerRight: {
    paddingLeft: 30,
    justifyContent: 'center',
  },
});
