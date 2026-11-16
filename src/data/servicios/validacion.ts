import { ErrorApp } from '../errores';

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normaliza "correo o teléfono": correo en minúsculas, teléfono solo dígitos. */
export function normalizarIdentificador(valor: string): string {
  const v = valor.trim();
  if (v.includes('@')) {
    const correo = v.toLowerCase();
    if (!RE_CORREO.test(correo)) throw new ErrorApp('Escribe un correo válido.');
    return correo;
  }
  const digitos = v.replace(/\D/g, '');
  if (digitos.length < 10) throw new ErrorApp('Escribe un correo o un teléfono de 10 dígitos.');
  return digitos;
}

export function validarNombre(nombre: string, campo = 'tu nombre'): string {
  const n = nombre.trim().replace(/\s+/g, ' ');
  if (n.length < 2) throw new ErrorApp(`Escribe ${campo}.`);
  if (n.length > 40) throw new ErrorApp('El nombre es muy largo (máximo 40 caracteres).');
  return n;
}

export function validarContrasena(contrasena: string) {
  if (contrasena.length < 8) throw new ErrorApp('La contraseña debe tener al menos 8 caracteres.');
}

export function validarPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new ErrorApp('El PIN debe ser de 4 números.');
}

export function validarCodigoFormato(codigo: string): string {
  const c = codigo.replace(/\D/g, '');
  if (c.length !== 6) throw new ErrorApp('El código tiene 6 números.');
  return c;
}
