import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { Colors } from '@app/styles/colors';
import { Images } from '@app/utilities/images';
import {
  StyleProp,
  Text,
  TextInput,
  View,
  ViewStyle,
  TouchableOpacity,
  Image,
  TextInputProps,
} from 'react-native';
import { styles } from './TextField.styles';

type Props = {
  error?: string;
  style?: StyleProp<ViewStyle>;
  maxLength?: number;
};

type TextFieldProps = TextInputProps & Props;

// forwardRef<TextInput, ...> says what the ref points at (the inner TextInput), so a
// parent's ref type is checked. The generic only adds types; runtime is unchanged.
export const TextField = forwardRef<TextInput, TextFieldProps>((props, ref) => {
  const {
    value,
    placeholder,
    error,
    style,
    secureTextEntry = false,
    maxLength,
    onChangeText,
    onBlur,
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [inputTextHidden, setInputTextHidden] =
    useState<boolean>(secureTextEntry);

  const borderColor = useMemo(() => {
    if (isFocused) {
      return Colors.yellow1;
    } else {
      if (error !== undefined) {
        return Colors.red4;
      } else {
        if (value && value.length > 0) {
          return Colors.green5;
        } else {
          return Colors.gray22;
        }
      }
    }
  }, [isFocused, error, value]);

  const backgroundColor = useMemo(() => {
    if (error !== undefined && !isFocused) {
      return Colors.red5;
    } else {
      return Colors.white;
    }
  }, [error, isFocused]);

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.inputContainer,
          { borderColor: borderColor, backgroundColor: backgroundColor },
        ]}>
        <View style={styles.containerTextField}>
          {(isFocused || (value && value.length > 0)) && (
            <Text style={styles.textLabel}>{placeholder}</Text>
          )}
          <TextInput
            {...props}
            ref={ref}
            style={styles.textInput}
            secureTextEntry={inputTextHidden}
            autoCapitalize={'none'}
            placeholder={isFocused ? '' : placeholder}
            placeholderTextColor={Colors.gray16}
            maxLength={maxLength}
            onFocus={() => setIsFocused(true)}
            onBlur={obj => {
              setIsFocused(false);
              onBlur && onBlur(obj);
            }}
            onChangeText={onChangeText}
          />
        </View>
        {secureTextEntry && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setInputTextHidden(!inputTextHidden)}>
            <Image source={!inputTextHidden ? Images.Eye : Images.EyeClosed} />
          </TouchableOpacity>
        )}
      </View>
      {error !== undefined && !isFocused && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={Images.RedInfo} />
          <Text style={styles.labelError}>{error}</Text>
        </View>
      )}
    </View>
  );
});
