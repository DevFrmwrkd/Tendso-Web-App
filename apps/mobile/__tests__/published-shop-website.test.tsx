import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PublishedShopWebsite, publicShopWebsiteUrl } from '../components/field-agent/PublishedShopWebsite';
import { SiteFrame } from '../components/v2/owner/OwnerUI';

const mockOpen = jest.fn();
jest.mock('../services/links', () => ({ openExternalUrl: (...args: unknown[]) => mockOpen(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../components/v2/owner/OwnerUI', () => ({ SiteFrame: (props: unknown) =>
  require('react').createElement(require('react-native').View, { ...(props as object), testID: 'published-site-frame' }) }));
beforeEach(() => jest.clearAllMocks());

it.each([null, undefined, '', 'javascript:alert(1)', 'file:///private.jpg', 'https://u:p@example.com', '/preview/local'])
  ('omits invalid or unsafe published URL %s', value => {
    expect(publicShopWebsiteUrl(value)).toBeNull();
    const screen = render(<PublishedShopWebsite url={value} />);
    expect(screen.queryByTestId('published-site-frame')).toBeNull();
  });

it('embeds a real public URL in the existing read-only preview and offers the full site', () => {
  const screen = render(<PublishedShopWebsite url="https://shop.example.com/site" />);
  expect(screen.UNSAFE_getByType(SiteFrame).props).toMatchObject({
    uri: 'https://shop.example.com/site', height: 420, interactive: true, samplePreview: true,
  });
  fireEvent.press(screen.getByRole('button', { name: 'View website' }));
  expect(mockOpen).toHaveBeenCalledWith('https://shop.example.com/site');
});

it('handles preview failure and retry, resetting failures when the published URL changes', () => {
  const screen = render(<PublishedShopWebsite url="https://shop.example.com/" />);
  fireEvent(screen.UNSAFE_getByType(SiteFrame), 'previewError');
  expect(screen.getByText('The website preview could not load.')).toBeTruthy();
  expect(screen.queryByTestId('published-site-frame')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Try preview again' }));
  expect(screen.getByTestId('published-site-frame')).toBeTruthy();
  fireEvent(screen.UNSAFE_getByType(SiteFrame), 'previewError');
  screen.rerender(<PublishedShopWebsite url="https://new-shop.example.com/" />);
  expect(screen.getByTestId('published-site-frame').props.uri).toBe('https://new-shop.example.com/');
});

it('does not mount or open the website while offline and recovers on reconnect', () => {
  const screen = render(<PublishedShopWebsite url="https://shop.example.com/" isOffline />);
  expect(screen.getByText('Reconnect to see the live website.')).toBeTruthy();
  expect(screen.queryByTestId('published-site-frame')).toBeNull();
  expect(screen.getByRole('button', { name: 'View website' })).toBeDisabled();
  screen.rerender(<PublishedShopWebsite url="https://shop.example.com/" />);
  expect(screen.getByTestId('published-site-frame')).toBeTruthy();
});
