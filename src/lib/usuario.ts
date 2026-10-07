/** Los usuarios entran con usuario + contraseña; por dentro cada usuario es un correo interno que nadie ve. */
export const DOMINIO = 'usuarios.polyamsa.mx';
export const emailDe = (u: string) => `${u.trim().toLowerCase()}@${DOMINIO}`;
