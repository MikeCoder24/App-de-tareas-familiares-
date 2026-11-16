import { Alert, Platform } from 'react-native';

/** Confirmación con botón destructivo. En web (vista previa) usa window.confirm. */
export function confirmar(titulo: string, mensaje: string, textoAceptar = 'Aceptar'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  return new Promise((resolve) =>
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoAceptar, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export function avisar(titulo: string, mensaje: string) {
  if (Platform.OS === 'web') window.alert(`${titulo}\n\n${mensaje}`);
  else Alert.alert(titulo, mensaje);
}

/** Hoja de opciones simple. En web devuelve la primera opción (no hay hoja nativa). */
export function elegir<T extends string>(titulo: string, opciones: { valor: T; texto: string }[]): Promise<T | null> {
  if (Platform.OS === 'web') return Promise.resolve(opciones[0]?.valor ?? null);
  return new Promise((resolve) =>
    Alert.alert(
      titulo,
      undefined,
      [
        ...opciones.map((o) => ({ text: o.texto, onPress: () => resolve(o.valor) })),
        { text: 'Cancelar', style: 'cancel' as const, onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    ),
  );
}
