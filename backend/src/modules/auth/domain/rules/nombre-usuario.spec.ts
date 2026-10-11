import {
  esNombreUsuarioValido,
  LONGITUD_MAXIMA_NOMBRE_USUARIO,
  LONGITUD_MINIMA_NOMBRE_USUARIO,
  normalizarNombreUsuario,
  PATRON_NOMBRE_USUARIO,
  validarNombreUsuario,
} from './nombre-usuario';

describe('nombre-usuario', () => {
  describe('normalizacion', () => {
    it('recorta los espacios y pasa a minusculas', () => {
      expect(normalizarNombreUsuario('  Ana.Perez  ')).toBe('ana.perez');
      expect(normalizarNombreUsuario('ADMIN')).toBe('admin');
    });

    it('acepta un valor con mayusculas y espacios que ya normalizado es valido', () => {
      expect(validarNombreUsuario('  ANA.PEREZ  ')).toEqual([]);
      expect(esNombreUsuarioValido('  ANA.PEREZ  ')).toBe(true);
    });

    it('normalizar es idempotente', () => {
      const una = normalizarNombreUsuario('  ADMIN  ');
      expect(normalizarNombreUsuario(una)).toBe(una);
    });
  });

  describe('longitud', () => {
    it('acepta un nombre de exactamente el minimo', () => {
      const nombre = 'a'.repeat(LONGITUD_MINIMA_NOMBRE_USUARIO);
      expect(validarNombreUsuario(nombre)).toEqual([]);
      expect(esNombreUsuarioValido(nombre)).toBe(true);
    });

    it('acepta un nombre de exactamente el maximo', () => {
      const nombre = 'a'.repeat(LONGITUD_MAXIMA_NOMBRE_USUARIO);
      expect(PATRON_NOMBRE_USUARIO.test(nombre)).toBe(true);
      expect(validarNombreUsuario(nombre)).toEqual([]);
    });

    it('rechaza un nombre demasiado corto', () => {
      const nombre = 'a'.repeat(LONGITUD_MINIMA_NOMBRE_USUARIO - 1);
      expect(esNombreUsuarioValido(nombre)).toBe(false);
      expect(validarNombreUsuario(nombre)).toHaveLength(1);
      expect(validarNombreUsuario(nombre)[0]).toContain('entre 3 y 30 caracteres');
    });

    it('rechaza un nombre vacio', () => {
      expect(esNombreUsuarioValido('')).toBe(false);
      expect(esNombreUsuarioValido('   ')).toBe(false);
    });

    it('rechaza un nombre demasiado largo', () => {
      const nombre = 'a'.repeat(LONGITUD_MAXIMA_NOMBRE_USUARIO + 1);
      expect(esNombreUsuarioValido(nombre)).toBe(false);
      expect(validarNombreUsuario(nombre)[0]).toContain('entre 3 y 30 caracteres');
    });
  });

  describe('caracteres', () => {
    it('acepta digitos, punto, guion y guion bajo', () => {
      expect(esNombreUsuarioValido('usuario.1-2_3')).toBe(true);
    });

    it('rechaza caracteres invalidos', () => {
      expect(esNombreUsuarioValido('usuario con espacio')).toBe(false);
      expect(esNombreUsuarioValido('usuario@dominio')).toBe(false);
      expect(esNombreUsuarioValido('usuario+etiqueta')).toBe(false);
      expect(esNombreUsuarioValido('usu#ario')).toBe(false);
    });

    it('rechaza un nombre que empieza por simbolo', () => {
      expect(esNombreUsuarioValido('.usuario')).toBe(false);
      expect(esNombreUsuarioValido('_usuario')).toBe(false);
      expect(esNombreUsuarioValido('-usuario')).toBe(false);
    });

    it('acepta un nombre que empieza por digito', () => {
      expect(esNombreUsuarioValido('1usuario')).toBe(true);
    });
  });

  it('devuelve la lista de problemas y un helper booleano coherente', () => {
    const problemas = validarNombreUsuario('.x');
    expect(problemas.length).toBeGreaterThan(0);
    expect(esNombreUsuarioValido('.x')).toBe(false);
  });
});
