import {
  LoginThrottleService,
  MAX_FALLOS_POR_IP,
  MAX_FALLOS_POR_USUARIO_IP,
  VENTANA_INTENTOS_MS,
} from './login-throttle.service';

describe('LoginThrottleService', () => {
  let ahora: number;
  let servicio: LoginThrottleService;

  const reloj = () => ahora;

  beforeEach(() => {
    ahora = 1_000_000;
    servicio = new LoginThrottleService(reloj);
  });

  afterEach(() => {
    servicio.onModuleDestroy();
  });

  function fallos(
    nombreUsuario: string,
    ip: string,
    cantidad: number,
  ): void {
    for (let i = 0; i < cantidad; i += 1) {
      servicio.registrarFallo(nombreUsuario, ip);
    }
  }

  it('no bloquea mientras no haya fallos', () => {
    expect(servicio.verificar('ana', '1.1.1.1')).toBeNull();
  });

  it('bloquea el par (usuario, IP) al alcanzar el maximo de fallos', () => {
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP - 1);
    expect(servicio.verificar('ana', '1.1.1.1')).toBeNull();

    servicio.registrarFallo('ana', '1.1.1.1');
    const espera = servicio.verificar('ana', '1.1.1.1');

    expect(espera).not.toBeNull();
    expect(espera).toBeLessThanOrEqual(VENTANA_INTENTOS_MS / 1000);
  });

  it('normaliza el usuario: mayusculas y espacios cuentan para el mismo par', () => {
    fallos('  ANA  ', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP);

    expect(servicio.verificar('ana', '1.1.1.1')).not.toBeNull();
  });

  it('no bloquea a un usuario distinto desde la misma IP', () => {
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP);

    expect(servicio.verificar('otro', '1.1.1.1')).toBeNull();
  });

  it('un login correcto reinicia el contador del par (usuario, IP)', () => {
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP);
    expect(servicio.verificar('ana', '1.1.1.1')).not.toBeNull();

    servicio.registrarExito('ana', '1.1.1.1');

    expect(servicio.verificar('ana', '1.1.1.1')).toBeNull();
  });

  it('el exito NO borra el contador por IP (evita resetear la proteccion)', () => {
    // Se reparten fallos entre usuarios distintos para no tocar el tope por
    // par y acercarse solo al tope por IP.
    for (let i = 0; i < MAX_FALLOS_POR_IP; i += 1) {
      servicio.registrarFallo(`usuario${i}`, '1.1.1.1');
    }
    servicio.registrarExito('usuario0', '1.1.1.1');

    expect(servicio.verificar('usuario-nuevo', '1.1.1.1')).not.toBeNull();
  });

  it('bloquea la IP completa al superar su tope, aunque cambie el usuario', () => {
    for (let i = 0; i < MAX_FALLOS_POR_IP - 1; i += 1) {
      servicio.registrarFallo(`usuario${i}`, '1.1.1.1');
    }
    expect(servicio.verificar('usuario-nuevo', '1.1.1.1')).toBeNull();

    servicio.registrarFallo('usuario-final', '1.1.1.1');

    expect(servicio.verificar('usuario-nuevo', '1.1.1.1')).not.toBeNull();
  });

  it('desbloquea al vencer la ventana fija', () => {
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP);
    expect(servicio.verificar('ana', '1.1.1.1')).not.toBeNull();

    ahora += VENTANA_INTENTOS_MS;

    expect(servicio.verificar('ana', '1.1.1.1')).toBeNull();
  });

  it('los segundos de espera bajan conforme avanza la ventana', () => {
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP);
    const inicial = servicio.verificar('ana', '1.1.1.1') as number;

    ahora += 10_000;
    const despues = servicio.verificar('ana', '1.1.1.1') as number;

    expect(despues).toBeLessThan(inicial);
    expect(despues).toBeGreaterThan(0);
  });

  it('los fallos nunca producen una espera de 0 segundos', () => {
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP);

    ahora += VENTANA_INTENTOS_MS - 1;
    const espera = servicio.verificar('ana', '1.1.1.1');

    expect(espera).toBe(1);
  });

  it('limpiarVencidas elimina las entradas cuya ventana vencio', () => {
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP);

    ahora += VENTANA_INTENTOS_MS;
    servicio.limpiarVencidas(ahora);

    // Al reiniciar el contador, hacen falta de nuevo todos los fallos.
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP - 1);
    expect(servicio.verificar('ana', '1.1.1.1')).toBeNull();
  });

  it('una IP distinta no comparte el contador por usuario', () => {
    fallos('ana', '1.1.1.1', MAX_FALLOS_POR_USUARIO_IP);

    expect(servicio.verificar('ana', '2.2.2.2')).toBeNull();
  });
});
