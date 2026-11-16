/** Error con un mensaje listo para mostrarse al usuario. */
export class ErrorApp extends Error {}

export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorApp) return e.message;
  console.error(e);
  return 'Algo salió mal. Intenta de nuevo.';
}
