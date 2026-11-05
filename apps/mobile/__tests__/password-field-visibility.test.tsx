import React, { createRef, useState } from 'react';
import { Platform, Pressable, Text, type TextInput, type TextInputProps } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { Field } from '../components/v2/Field';

type NativeInput = {
  text: string;
  focused: boolean;
  selection: { start: number; end: number };
  focus: jest.Mock;
  blur: jest.Mock;
  setSelection: jest.Mock;
  isFocused: () => boolean;
};
const mockInputs = new Map<string, NativeInput>();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native/Libraries/Components/TextInput/TextInput', () => {
  const React = require('react');
  const createHostElement = React['createElement'];
  const Platform = require('react-native/Libraries/Utilities/Platform').default;
  const NativeTextInput = React.forwardRef((props: TextInputProps, ref: React.Ref<NativeInput>) => {
    const latest = React.useRef(props);
    latest.current = props;
    const [, redraw] = React.useReducer((revision: number) => revision + 1, 0);
    const input = React.useRef(null) as React.MutableRefObject<NativeInput | null>;
    if (!input.current) {
      const state: NativeInput = {
        text: props.value ?? props.defaultValue ?? '', focused: false, selection: { start: 0, end: 0 },
        focus: jest.fn(() => {
          state.focused = true;
          latest.current.onFocus?.({ nativeEvent: {} } as never);
        }),
        blur: jest.fn(() => {
          state.focused = false;
          latest.current.onBlur?.({ nativeEvent: {} } as never);
        }),
        setSelection: jest.fn((start: number, end: number) => { state.selection = { start, end }; }),
        isFocused: () => state.focused,
      };
      input.current = state;
    }
    const state = input.current;
    React.useImperativeHandle(ref, () => state, [state]);
    React.useLayoutEffect(() => {
      mockInputs.set(props.accessibilityLabel!, state);
      return () => { if (mockInputs.get(props.accessibilityLabel!) === state) mockInputs.delete(props.accessibilityLabel!); };
    }, [props.accessibilityLabel, state]);
    React.useLayoutEffect(() => {
      if (props.value !== undefined) state.text = props.value;
    }, [props.value, state]);
    const previousSecure = React.useRef(props.secureTextEntry);
    React.useLayoutEffect(() => {
      // Model UIKit losing native text on an in-place secure-entry switch. A JS
      // value-only assertion misses this because the controlled value is unchanged.
      if (Platform.OS === 'ios' && previousSecure.current !== props.secureTextEntry) {
        state.text = '';
        redraw();
      }
      previousSecure.current = props.secureTextEntry;
    }, [props.secureTextEntry, state]);
    return createHostElement('TextInput', {
      ...props,
      onFocus: () => { state.focused = true; props.onFocus?.({ nativeEvent: {} } as never); },
      onBlur: () => { state.focused = false; props.onBlur?.({ nativeEvent: {} } as never); },
      onChangeText: (text: string) => {
        state.text = text;
        state.selection = { start: text.length, end: text.length };
        props.onChangeText?.(text);
      },
      onSelectionChange: (event: Parameters<NonNullable<TextInputProps['onSelectionChange']>>[0]) => {
        state.selection = event.nativeEvent.selection;
        props.onSelectionChange?.(event);
      },
    });
  });
  return { __esModule: true, default: NativeTextInput };
});

function PasswordForm({ initial = '', inputRef, confirm = false }: {
  initial?: string; inputRef?: React.Ref<TextInput>; confirm?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [confirmation, setConfirmation] = useState(initial);
  const [shown, setShown] = useState(false);
  return <>
    <Field ref={inputRef} label="Password" value={value} onChangeText={setValue} secureTextEntry={!shown} />
    {confirm ? <Field label="Confirm password" value={confirmation} onChangeText={setConfirmation} secureTextEntry={!shown} /> : null}
    <Pressable onPress={() => setShown((current) => !current)} accessibilityRole="button" accessibilityLabel="Toggle password">
      <Text>Toggle password</Text>
    </Pressable>
  </>;
}

const native = (label = 'Password') => mockInputs.get(label)!;
const select = (screen: ReturnType<typeof render>, label: string, start: number, end = start) =>
  fireEvent(screen.getByLabelText(label), 'selectionChange', { nativeEvent: { selection: { start, end } } });
const toggle = (screen: ReturnType<typeof render>) => fireEvent.press(screen.getByRole('button', { name: 'Toggle password' }));
const initialPlatform = Platform.OS;

beforeEach(() => { mockInputs.clear(); Platform.OS = 'ios'; });
afterEach(() => { Platform.OS = initialPlatform; });

it('retains typed native text through show/hide and accepts subsequent edits and deletion', () => {
  const screen = render(<PasswordForm />);
  fireEvent(screen.getByLabelText('Password'), 'focus');
  fireEvent.changeText(screen.getByLabelText('Password'), 'a secure password');
  select(screen, 'Password', 7);
  toggle(screen);
  expect(native().text).toBe('a secure password');
  expect(native().focused).toBe(true);
  expect(native().selection).toEqual({ start: 7, end: 7 });
  fireEvent.changeText(screen.getByLabelText('Password'), 'a secure password!');
  select(screen, 'Password', 18);
  toggle(screen);
  expect(native().text).toBe('a secure password!');
  fireEvent.changeText(screen.getByLabelText('Password'), 'a secure password');
  expect(native().text).toBe('a secure password');
  fireEvent.changeText(screen.getByLabelText('Password'), '');
  expect(native().text).toBe('');
  expect(screen.getByLabelText('Password').props.value).toBe('');
});

it('preserves an autofilled value without opening the keyboard for an unfocused field', () => {
  const screen = render(<PasswordForm initial="autofilled-long-password" />);
  toggle(screen);
  expect(native().text).toBe('autofilled-long-password');
  expect(native().focus).not.toHaveBeenCalled();
  toggle(screen);
  expect(native().text).toBe('autofilled-long-password');
  expect(native().focus).not.toHaveBeenCalled();
});

it.each(['Password', 'Confirm password'])('restores only the focused %s when both fields share an eye toggle', (label) => {
  const screen = render(<PasswordForm initial="matching-password" confirm />);
  fireEvent(screen.getByLabelText(label), 'focus');
  select(screen, label, 3, 7);
  toggle(screen);
  const other = label === 'Password' ? 'Confirm password' : 'Password';
  expect(native(label).focused).toBe(true);
  expect(native(label).selection).toEqual({ start: 3, end: 7 });
  expect(native(other).focus).not.toHaveBeenCalled();
  expect(native(label).text).toBe('matching-password');
  expect(native(other).text).toBe('matching-password');
});

it('keeps the forwarded ref connected to the currently displayed input', () => {
  const ref = createRef<TextInput>();
  const screen = render(<PasswordForm initial="preserved-password" inputRef={ref} />);
  toggle(screen);
  expect(ref.current).toBe(native());
  expect(native().text).toBe('preserved-password');
  expect(ref.current?.isFocused()).toBe(false);
});

it('keeps the Android editor stable while switching password visibility', () => {
  Platform.OS = 'android';
  const screen = render(<PasswordForm initial="android-password" />);
  fireEvent(screen.getByLabelText('Password'), 'focus');
  select(screen, 'Password', 4);
  const editor = native();
  toggle(screen);
  expect(native()).toBe(editor);
  expect(native().text).toBe('android-password');
  expect(native().selection).toEqual({ start: 4, end: 4 });
  expect(native().focus).not.toHaveBeenCalled();
});

it('keeps ordinary fields stable and forwards caller focus and selection events', () => {
  const onFocus = jest.fn();
  const onSelectionChange = jest.fn();
  const screen = render(<Field label="Email" value="juan@example.com" onFocus={onFocus} onSelectionChange={onSelectionChange} />);
  fireEvent(screen.getByLabelText('Email'), 'focus');
  select(screen, 'Email', 2, 5);
  const editor = native('Email');
  screen.rerender(<Field label="Email" value="updated@example.com" onFocus={onFocus} onSelectionChange={onSelectionChange} />);
  expect(native('Email')).toBe(editor);
  expect(native('Email').text).toBe('updated@example.com');
  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onSelectionChange).toHaveBeenCalledWith({ nativeEvent: { selection: { start: 2, end: 5 } } });
});
