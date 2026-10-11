import { Redirect } from 'expo-router';

// Dashboard has moved to the tabs navigator.
// This redirect handles any lingering deep-links to /(app)/dashboard.
export default function Dashboard() {
  return <Redirect href={'/(app)/(tabs)/' as any} />;
}
