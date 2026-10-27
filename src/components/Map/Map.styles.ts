import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius } from '@app/styles/theme';

const styles = StyleSheet.create({
  map: {
    width: 143,
    height: 138,
    borderRadius: radius.xl,
    backgroundColor: Colors.gray1,
    marginRight: 16,
  },
});

export default styles;
