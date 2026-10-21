import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  BigNumber,
  Button,
  Card,
  Chip,
  EmptyState,
  ListRow,
  Pill,
  ProgressSteps,
  ScreenShell,
  StatCard,
} from '../components/v2';
import { colors, MIN_FONT_SIZE } from '../theme/v2';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

/** Every rendered Text must be >= 16px. */
function expectNoSmallText(root: ReturnType<typeof render>) {
  const sizes = root.UNSAFE_getAllByType(require('react-native').Text).map((n: any) => StyleSheet.flatten(n.props.style)?.fontSize);
  sizes.forEach((s: number | undefined) => expect(s).toBeGreaterThanOrEqual(MIN_FONT_SIZE));
}

describe('Button', () => {
  it('is an accessible >= 56pt pill with an accent fill and ink text', () => {
    const onPress = jest.fn();
    const r = render(<Button title="Next" onPress={onPress} />);
    const btn = r.getByRole('button', { name: 'Next' });
    const style = StyleSheet.flatten(btn.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(56);
    expect(style.backgroundColor).toBe(colors.accent);
    expect(StyleSheet.flatten(r.getByText('Next').props.style).color).toBe(colors.onAccent);
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reports disabled and busy state and ignores presses', () => {
    const onPress = jest.fn();
    const r = render(<Button title="Save" loading onPress={onPress} />);
    const btn = r.getByRole('button', { name: 'Save' });
    expect(btn.props.accessibilityState).toEqual({ disabled: true, busy: true });
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps md and every variant at 56pt or more', () => {
    for (const variant of ['primary', 'dark', 'ghost'] as const) {
      const r = render(<Button title={variant} variant={variant} size="md" />);
      expect(StyleSheet.flatten(r.getByRole('button').props.style).minHeight).toBeGreaterThanOrEqual(56);
    }
  });
});

describe('Pill and Chip', () => {
  it('Pill is a selectable button only when tappable', () => {
    const onPress = jest.fn();
    const r = render(<Pill label="Food" selected onPress={onPress} />);
    const pill = r.getByRole('button', { name: 'Food' });
    expect(pill.props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(pill);
    expect(onPress).toHaveBeenCalled();
    expect(render(<Pill label="Static" />).queryByRole('button')).toBeNull();
    expectNoSmallText(r);
  });

  it('Chip text is >= 16', () => {
    expectNoSmallText(render(<Chip label="Live" tone="ok" />));
  });
});

describe('ProgressSteps', () => {
  it('marks done / current / todo segments and exposes the count', () => {
    const r = render(<ProgressSteps current={4} tone="dark" label="Question" />);
    const bar = r.getByRole('progressbar');
    expect(bar.props.accessibilityLabel).toBe('Question 4 of 10');
    expect(bar.props.accessibilityValue).toEqual({ min: 1, max: 10, now: 4 });
    const bg = (n: number) => StyleSheet.flatten(r.getByTestId(`progress-seg-${n}`).props.style).backgroundColor;
    expect(bg(3)).toBe(colors.onDark);
    expect(bg(4)).toBe(colors.accent);
    expect(bg(5)).toBe(colors.onDarkMuted);
  });

  it('clamps out-of-range values', () => {
    const r = render(<ProgressSteps current={99} />);
    expect(r.getByRole('progressbar').props.accessibilityValue.now).toBe(10);
  });
});

describe('Card, StatCard, BigNumber, ListRow, EmptyState', () => {
  it('Card becomes a button when pressable', () => {
    const onPress = jest.fn();
    const r = render(<Card onPress={onPress} accessibilityLabel="Open"><Chip label="x" /></Card>);
    fireEvent.press(r.getByRole('button', { name: 'Open' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('BigNumber reads as one sentence', () => {
    const r = render(<BigNumber value="₱4,999" label="One time" />);
    expect(r.getByLabelText('₱4,999, One time')).toBeTruthy();
    expectNoSmallText(r);
  });

  it('StatCard shows number, label and chip', () => {
    const r = render(<StatCard value="12" label="Sites" chip={{ label: 'Live', tone: 'ok' }} />);
    expect(r.getByText('12')).toBeTruthy();
    expect(r.getByText('Live')).toBeTruthy();
    expectNoSmallText(r);
  });

  it('ListRow is a button with a combined label when tappable', () => {
    const onPress = jest.fn();
    const r = render(<ListRow title="Kalan" subtitle="Manila" onPress={onPress} />);
    fireEvent.press(r.getByRole('button', { name: 'Kalan, Manila' }));
    expect(onPress).toHaveBeenCalled();
    expectNoSmallText(r);
  });

  it('EmptyState renders title, body and one action', () => {
    const onAction = jest.fn();
    const r = render(<EmptyState title="Nothing yet" body="Add one." actionLabel="Add" onAction={onAction} />);
    fireEvent.press(r.getByRole('button', { name: 'Add' }));
    expect(onAction).toHaveBeenCalled();
    expect(r.getByRole('header')).toBeTruthy();
    expectNoSmallText(r);
  });
});

describe('ScreenShell', () => {
  it('renders one title, children and the primary action slot; back is labelled', () => {
    const onBack = jest.fn();
    const r = wrap(
      <ScreenShell title="Question 1" onBack={onBack} progress={0.3} footer={<Button title="Next" />}>
        <Card><Chip label="body" /></Card>
      </ScreenShell>,
    );
    expect(r.getByRole('header')).toBeTruthy();
    expect(r.getByRole('button', { name: 'Next' })).toBeTruthy();
    fireEvent.press(r.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    expect(r.getByRole('progressbar')).toBeTruthy();
    expectNoSmallText(r);
  });

  it('supports the fixed (non-scrolling) and dark variants', () => {
    const r = wrap(<ScreenShell title="Hi" scroll={false} tone="dark" />);
    expect(r.getByText('Hi')).toBeTruthy();
  });
});
