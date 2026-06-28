import React from 'react'
import { TextInput, TextInputProps, StyleSheet } from 'react-native'

type Props = TextInputProps & { onChangeNumber: (n: number) => void }

export function NumericInput({ onChangeNumber, style, ...props }: Props) {
  return (
    <TextInput
      keyboardType="decimal-pad"
      onFocus={(e) => {
        // Select all on focus so user can immediately type a new value
        e.target.setNativeProps?.({ selection: { start: 0, end: 999 } })
      }}
      onChangeText={(t) => {
        const n = parseFloat(t.replace(/,/g, ''))
        onChangeNumber(isNaN(n) ? 0 : n)
      }}
      style={[styles.input, style]}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    textAlign: 'right',
  },
})
