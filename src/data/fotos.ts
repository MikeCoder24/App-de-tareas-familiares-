// Fotos (familia, evidencia). En modo local se copian a la carpeta de documentos de la app;
// con Supabase se subirán a Storage y aquí se guardará la URL pública.
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { nuevoId } from './cripto';
import { ErrorApp } from './errores';

export type OrigenFoto = 'galeria' | 'camara';

/** Abre la galería o la cámara. Devuelve una URI que no se borra, o null si se canceló. */
export async function elegirFoto(origen: OrigenFoto, opciones: { cuadrada?: boolean } = {}): Promise<string | null> {
  const config: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: opciones.cuadrada ?? false,
    aspect: opciones.cuadrada ? [1, 1] : undefined,
    quality: 0.6,
    base64: Platform.OS === 'web',
  };
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) throw new ErrorApp('Necesitamos permiso para usar la cámara. Actívalo en los ajustes del teléfono.');
  }
  const r = origen === 'camara' ? await ImagePicker.launchCameraAsync(config) : await ImagePicker.launchImageLibraryAsync(config);
  if (r.canceled || !r.assets[0]) return null;
  return guardar(r.assets[0]);
}

async function guardar(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  // En web (vista previa) el archivo temporal no sobrevive a recargar: se guarda como data URL.
  if (Platform.OS === 'web') {
    return asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
  }
  const carpeta = new Directory(Paths.document, 'fotos');
  carpeta.create({ idempotent: true, intermediates: true });
  const destino = new File(carpeta, `${nuevoId()}.jpg`);
  await new File(asset.uri).copy(destino);
  return destino.uri;
}
