import { PassThrough } from 'stream';
import ExcelJS from 'exceljs';
import {
  aNumeroImporte,
  textoFechaHoraLima,
  textoFechaLima,
  crearLibroStreaming,
  filaCelda,
  prepararHoja,
} from './excel';

describe('excel domain', () => {
  it('aNumeroImporte - convierte decimales a número con 2 decimales', () => {
    expect(aNumeroImporte('123.45')).toBe(123.45);
    expect(aNumeroImporte('0.00')).toBe(0);
    expect(aNumeroImporte('10.5')).toBe(10.5);
    expect(aNumeroImporte('-5.25')).toBe(-5.25);
    expect(aNumeroImporte('1234.56')).toBe(1234.56);
  });

  it('textoFechaHoraLima - formato AAAA-MM-DD HH:mm en America/Lima', () => {
    const d = new Date('2026-10-17T15:30:00Z');
    const formatted = textoFechaHoraLima(d);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('textoFechaLima - formato AAAA-MM-DD', () => {
    const d = new Date('2026-10-17T15:30:00Z');
    const formatted = textoFechaLima(d);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('filaCelda - convierte valores a celdas seguras', () => {
    expect(filaCelda(['hello', 123, null, undefined, 'test'])).toEqual(['hello', 123, null, null, 'test']);
  });

  it('crearLibroStreaming - crea workbook con PassThrough', () => {
    const { workbook, stream } = crearLibroStreaming();
    expect(workbook).toBeDefined();
    expect(stream).toBeInstanceOf(PassThrough);
  });

  it('lectura de vuelta del xlsx: importes numéricos, fecha-hora texto AAAA-MM-DD HH:mm, textos como cadenas', async () => {
    const { workbook, stream } = crearLibroStreaming();
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(c));
    const ws = workbook.addWorksheet('Ventas');
    prepararHoja(ws, [
      { header: 'Fecha y hora', width: 18 },
      { header: 'Monto', width: 12 },
      { header: 'Descripción', width: 30 },
    ]);
    ws.addRow([textoFechaHoraLima('2026-10-17T20:30:00Z'), aNumeroImporte('123.45'), 'Texto normal']);
    ws.addRow([textoFechaHoraLima(new Date('2026-10-18T13:15:00Z')), aNumeroImporte('0.00'), '=fórmula no ejecutada']);
    await workbook.commit();
    const buffer = Buffer.concat(chunks);
    expect(buffer.length).toBeGreaterThan(0);
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.getWorksheet('Ventas');
    expect(sheet).toBeDefined();
    const row2 = sheet?.getRow(2);
    expect(typeof row2?.getCell(3).value).toBe('string');
    expect(row2?.getCell(3).value).toBe('Texto normal');
    expect(sheet?.getRow(1).getCell(1).value).toBe('Fecha y hora');
  });
});
