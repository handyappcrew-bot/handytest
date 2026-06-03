import React, { useState } from "react";
import { TextInput, TextInputProps } from "react-native";

interface FocusInputProps extends TextInputProps {
  error?: boolean;
  defaultBorderColor?: string;
}

const FocusInput: React.FC<FocusInputProps> = ({
  style,
  onFocus,
  onBlur,
  error,
  defaultBorderColor = "#EBEBEB",
  ...props
}) => {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? "#FF3D3D" : focused ? "#4261FF" : defaultBorderColor;

  return (
    <TextInput
      {...props}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={[style, { borderColor }]}
    />
  );
};

export default FocusInput;
