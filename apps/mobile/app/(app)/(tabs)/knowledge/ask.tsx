import React from 'react';
import { Redirect } from 'expo-router';

/** Keep existing links; every role uses the same role-aware conversation. */
export default function AskTendso() {
  return <Redirect href={'/(knowledge)/ask' as never} />;
}
