import {
  protegerFormula,
  campo,
  textoDeCelda,
  construirCsv,
} from './csv';

describe('csv domain', () => {
  it('protegerFormula - prefija con comilla simple cuando empieza por =, +, -, @, tabulador o retorno de carro', () => {
    expect(protegerFormula('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(protegerFormula('+1+2')).toBe("'+1+2");
    expect(protegerFormula('-5')).toBe("'-5");
    expect(protegerFormula('@SUM')).toBe("'@SUM");
    expect(protegerFormula('\tdata')).toBe("'\tdata");
    expect(protegerFormula('\r\n')).toBe("'\r\n");
    expect(protegerFormula('normal')).toBe('normal');
    expect(protegerFormula('123')).toBe('123');
  });

  it('textoDeCelda - convierte valores nulos/undefined a cadena vacía y otros a string', () => {
    expect(textoDeCelda(null)).toBe('');
    expect(textoDeCelda(undefined)).toBe('');
    expect(textoDeCelda('hello')).toBe('hello');
    expect(textoDeCelda(123)).toBe('123');
    expect(textoDeCelda('Café')).toBe('Café');
  });

  it('campo - cita si contiene coma, comillas o saltos y escapa comillas dobles', () => {
    expect(campo('simple')).toBe('simple');
    expect(campo('hello "world"')).toBe('"hello ""world"""');
    expect(campo('hello, world')).toBe('"hello, world"');
    expect(campo('line\nbreak')).toBe('"line\nbreak"');
  });

  it('construirCsv - añade BOM UTF-8, usa CRLF y protege fórmulas', () => {
    const csv = construirCsv(['Col1', 'Col2'], [['a', 'b'], ['c', '=HACK']]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('Col1,Col2\r\n');
    expect(csv).toContain('a,b\r\n');
    expect(csv).toMatch(/c,.*=HACK/);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('protege fórmulas con =, +, -, @, tabulador y retorno de carro', () => {
    expect(protegerFormula('=cmd|')).toBe("'=cmd|");
    expect(protegerFormula('+123')).toBe("'+123");
    expect(protegerFormula('-123')).toBe("'-123");
    expect(protegerFormula('@SUM')).toBe("'@SUM");
    expect(protegerFormula('\tvalue')).toBe("'\tvalue");
    expect(protegerFormula('\rvalue')).toBe("'\rvalue");
  });

  it('escapa comillas dobles y cita campos con comas/saltos', () => {
    expect(campo('a"b')).toBe('"a""b"');
    expect(campo('a,b')).toBe('"a,b"');
    expect(campo('a\nb')).toBe('"a\nb"');
    expect(campo('a\rb')).toBe('"a\rb"');
  });

  it('textoDeCelda maneja nulos, undefined y acentos', () => {
    expect(textoDeCelda(null)).toBe('');
    expect(textoDeCelda(undefined)).toBe('');
    expect(textoDeCelda('mañana')).toBe('mañana');
    expect(textoDeCelda(0)).toBe('0');
  });
});
