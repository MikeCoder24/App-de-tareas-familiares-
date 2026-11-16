import { Text } from 'react-native';

export function TabIcono({ emoji, activo }: { emoji: string; activo: boolean }) {
  return <Text style={{ fontSize: 22, opacity: activo ? 1 : 0.45 }}>{emoji}</Text>;
}
