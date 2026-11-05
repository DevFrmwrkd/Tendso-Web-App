import React from 'react';
import { CommunityFinds } from '../../../components/field-agent/CommunityFinds';
import { FieldAgentWorkspace } from '../../../components/field-agent/FieldAgentWorkspace';

export default function FindsScreen() {
  return <FieldAgentWorkspace>{() => <CommunityFinds />}</FieldAgentWorkspace>;
}
