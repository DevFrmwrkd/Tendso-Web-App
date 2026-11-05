import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { highlightParts } from '../../services/knowledge/search';
import { colors, fonts } from '../../theme/v2';

/** Renders `text` with search terms from `query` highlighted (accent fill, ink text). */
export function Highlight({
  text,
  query,
  style,
  numberOfLines,
}: {
  text: string;
  query: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const parts = highlightParts(text, query);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.m ? (
          <Text key={i} style={{ backgroundColor: colors.accent, color: colors.onAccent, fontFamily: fonts.bold }}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}
