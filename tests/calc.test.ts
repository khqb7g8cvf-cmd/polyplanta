import test from 'node:test';
import assert from 'node:assert/strict';
import { kgMillar, buildLineas, buildOT, opAll, DEF_CFG, sumL } from '../src/lib/calc.ts';
import { resumenMateriales, conciliacion } from '../src/lib/inv.ts';
import type { Maquina, Reporte, Paro, Amon, LineaRow, Material, Movimiento } from '../src/lib/types.ts';

const maq = (o: Partial<Maquina>): Maquina => ({ id: 'm', tipo: 'bolseo', nombre: 'M', marca: null, estado: 'ok', orden: 1, carriles: 1, carriles_max: null, golpes: null, kgh: null, sellos: [], tintas: null, imp_max: null, mat_max: null, caras: null, densidades: [], ancho_max: null, sin_fotocelda: false, rodillos: [], notas: null, ...o });
const linea = (o: Partial<LineaRow>): LineaRow => ({ id: 'l' + Math.random(), reporte_id: 'r1', maquina_id: 'b1', orden_id: null, cliente: null, ancho: 40, largo: 50, calibre: 200, densidad: 'baja', golpes: 50, kgh: null, carriles: 1, horas: null, operario: 'Juan', kilos: 442, nota: null, justificada: false, ...o });
const rep = (id: string, fecha: string, turno: 1 | 2, ls: LineaRow[]): Reporte => ({ id, fecha, turno, reporte_lineas: ls.map((l) => ({ ...l, reporte_id: id })) });

test('kgMillar 55x60 cal 300 baja', () => {
  assert.ok(Math.abs(kgMillar(55, 60, 300, 'baja')! - 45.54) < 0.01);
});

test('turno: 552 esperados, 442 reales = 80%', () => {
  const l = buildLineas([rep('r1', '2026-10-06', 1, [linea({})])], [maq({ id: 'b1' })], [], DEF_CFG);
  assert.ok(Math.abs(l[0].exp! - 552) < 0.5);
  assert.ok(Math.abs(l[0].pct! - 0.8) < 0.005);
  assert.ok(Math.abs(sumL(l).falta - 110) < 0.5);
});

test('paro mecánico de 1.5 h baja lo esperado', () => {
  const paros: Paro[] = [{ id: 'p', maquina_id: 'b1', causa: 'Mecánico', inicio: new Date(2026, 9, 6, 9, 0).toISOString(), fin: new Date(2026, 9, 6, 10, 30).toISOString(), orden_id: null, nota: null }];
  const l = buildLineas([rep('r1', '2026-10-06', 1, [linea({})])], [maq({ id: 'b1' })], paros, DEF_CFG);
  assert.ok(Math.abs(l[0].exp! - 55.2 * 8.5) < 0.5);
});

const now = Date.parse('2026-10-07T12:00:00');
const ot = () => buildOT(buildLineas([rep('r1', '2026-10-06', 1, [linea({})])], [maq({ id: 'b1' })], [], DEF_CFG, now));

test('escalera: turno bajo sugiere Verbal', () => {
  assert.equal(opAll(ot(), [], DEF_CFG, now)[0].sug?.tipo, 'Verbal');
});
test('justificada no sugiere', () => {
  const o = buildOT(buildLineas([rep('r1', '2026-10-06', 1, [linea({ justificada: true })])], [maq({ id: 'b1' })], [], DEF_CFG, now));
  assert.equal(opAll(o, [], DEF_CFG, now)[0].sug, null);
});
test('ya sancionado no repite', () => {
  const a: Amon[] = [{ id: 'a', operario: 'Juan', tipo: 'Verbal', fecha: '2026-10-06', evidencia: null, nota: null }];
  assert.equal(opAll(ot(), a, DEF_CFG, now)[0].sug, null);
});

const mat: Material = { id: 'x', nombre: 'PEBD', categoria: 'resina', kg_por_saco: 25, minimo_kg: 1000, silo_kg: null, codigo: null, fabricante: null, activo: true };
const mv = (o: Partial<Movimiento>): Movimiento => ({ id: Math.random() + '', material_id: 'x', tipo: 'salida', fecha: '2026-10-05T10:00:00', delta_kg: -300, sacos: null, lote: null, proveedor: null, factura: null, costo_kg: null, maquina_id: null, orden_id: null, nota: null, ubicacion: 'sacos', motivo: null, referencia: null, created_by: null, created_at: '2026-10-05T10:00:00', ...o });

test('inventario: cobertura, mínimo, costo', () => {
  const movs = [mv({}), mv({ delta_kg: -300, fecha: '2026-10-06T10:00:00' }), mv({ tipo: 'entrada', delta_kg: 5000, costo_kg: 32, fecha: '2026-10-01T10:00:00' })];
  const r = resumenMateriales([mat], { x: 800 }, movs, now)[0];
  assert.equal(r.bajo, true);
  assert.equal(r.consumo30, 600);
  assert.ok(Math.abs(r.dias! - 40) < 0.01);
  assert.equal(r.valor, 800 * 32);
  assert.equal(r.sacos, 32);
});

test('conciliación salidas vs extruidos', () => {
  const l = buildLineas([rep('r1', '2026-10-05', 1, [linea({ maquina_id: 'e1', kilos: 250 })])], [maq({ id: 'e1', tipo: 'extrusion', kgh: 40 })], [], DEF_CFG, now);
  const c = conciliacion([mv({}), mv({ delta_kg: -100 })], l, '2026-10-01', '2026-10-07');
  assert.equal(c.salidas, 400); assert.equal(c.extruidos, 250); assert.equal(c.dif, 150);
});

import { agg, diasEntre, porOperador, paretoParos, porDiaSemana } from '../src/lib/analytics.ts';
const lc = (o: Partial<import('../src/lib/types.ts').LineaCalc>) => ({ id: Math.random() + '', reporte_id: 'r1', maquina_id: 'm1', orden_id: null, cliente: null, ancho: null, largo: null, calibre: null, densidad: null, golpes: null, kgh: 100, carriles: null, horas: null, operario: 'Ana', kilos: 800, nota: null, justificada: false, fecha: '2026-10-05', turno: 1 as const, tipo: 'extrusion' as const, exp: 1000, expRaw: 1000, excH: 0, pct: 0.8, pctRaw: 0.8, ...o });
test('analytics: agg y rangos', () => {
  const a = agg([lc({}), lc({ kilos: 1200, exp: 1000, pct: 1.2 })]);
  assert.equal(a.kg, 2000); assert.equal(a.pct, 1);
  assert.deepEqual(diasEntre('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
});
test('analytics: operadores y turnos bajos', () => {
  const r = porOperador([lc({}), lc({ reporte_id: 'r2', kilos: 1000, pct: 1 }), lc({ operario: 'Beto', reporte_id: 'r3', kilos: 500, pct: 0.5 })], DEF_CFG, ['2026-10-05']);
  assert.equal(r[0].operario, 'Ana'); assert.equal(r.find((x) => x.operario === 'Ana')!.bajos, 1); assert.equal(r.find((x) => x.operario === 'Beto')!.bajos, 1);
});
test('analytics: pareto y día de semana', () => {
  const p = paretoParos([{ id: '1', maquina_id: 'm1', causa: 'Mecánico', inicio: '2026-10-05T08:00:00', fin: '2026-10-05T10:00:00', orden_id: null, nota: null }, { id: '2', maquina_id: 'm1', causa: 'Comida', inicio: '2026-10-05T12:00:00', fin: '2026-10-05T12:30:00', orden_id: null, nota: null }], new Set(['m1']), '2026-10-01', '2026-10-07');
  assert.equal(p[0].causa, 'Mecánico'); assert.ok(Math.abs(p[0].h - 2) < 1e-6);
  assert.equal(porDiaSemana([lc({})])[0].kg, 800); // 2026-10-05 es lunes
});

import { kardex, existenciaDiaria, proveedores, salidasPor } from '../src/lib/inv.ts';
test('kardex: saldo corrido y existencia diaria', () => {
  const movs = [mv({ id: 'c', delta_kg: -200, fecha: '2026-10-05T10:00:00' }), mv({ id: 'b', delta_kg: -300, fecha: '2026-10-04T10:00:00' }), mv({ id: 'a', tipo: 'entrada', delta_kg: 1000, fecha: '2026-10-03T10:00:00' })];
  const k = kardex(movs, { x: { silo: 0, sacos: 500 } });
  assert.deepEqual(k.map((r) => r.saldo), [500, 700, 1000]);
  const k2 = kardex([mv({ id: 'p', ubicacion: 'silo', delta_kg: -100 }), mv({ id: 'q', ubicacion: 'sacos', delta_kg: -50 })], { x: { silo: 900, sacos: 400 } });
  assert.deepEqual(k2.map((r) => r.saldo), [900, 400]);
  assert.deepEqual(existenciaDiaria(movs, 500, ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']), [0, 1000, 700, 500]);
});
test('proveedores: precio ponderado y salidas por motivo', () => {
  const p = proveedores([mv({ tipo: 'entrada', delta_kg: 1000, costo_kg: 30, proveedor: 'A' }), mv({ tipo: 'entrada', delta_kg: 3000, costo_kg: 34, proveedor: 'A' })]);
  assert.equal(p[0].promedio, 33); assert.equal(p[0].ultimo, 34);
  assert.equal(salidasPor([mv({ motivo: 'merma' }), mv({ motivo: 'merma', delta_kg: -100 })], (m) => m.motivo || 'sin')[0].kg, 400);
});

import { lineaLibre, autorizacion } from '../src/lib/permisos.ts';
test('candado: 15 minutos o autorización vigente', () => {
  const now = Date.parse('2026-10-08T18:00:00Z');
  const l = { created_by: 'u1', created_at: '2026-10-08T17:50:00Z', reporte_id: 'r1', maquina_id: 'b1' };
  assert.equal(lineaLibre(l, 'u1', [], now), true);
  assert.equal(lineaLibre({ ...l, created_at: '2026-10-08T17:40:00Z' }, 'u1', [], now), false);
  assert.equal(lineaLibre(l, 'u2', [], now), false);
  const s = { id: 's', tabla: 'reporte_lineas', registro_id: null, reporte_id: 'r1', maquina_id: 'b1', resumen: '', motivo: 'x', estado: 'aprobada' as const, solicitada_por: 'u2', solicitada_at: '', resuelta_por: null, resuelta_at: null, vence_at: '2026-10-08T18:30:00Z' };
  assert.equal(lineaLibre({ ...l, created_at: '2026-10-08T17:00:00Z' }, 'u2', [s], now), true);
  assert.ok(autorizacion([s], 'r1', 'b1', 'u2', now));
  assert.equal(autorizacion([s], 'r1', 'b1', 'u2', Date.parse('2026-10-08T19:00:00Z')), undefined);
});

test('incidencia (faltó operador / máquina no trabajó) no entra a la estadística', () => {
  const l = buildLineas([rep('r1', '2026-10-06', 1, [linea({ incidencia: 'sin_operador', kilos: 0, operario: 'Sin operador' })]), rep('r2', '2026-10-06', 2, [linea({ incidencia: 'sin_trabajo', kilos: 0, operario: '—' })])], [maq({ id: 'b1' })], [], DEF_CFG);
  assert.equal(l.length, 0);
  assert.equal(buildOT(l).length, 0);
});

test('varias órdenes: lo esperado usa las horas capturadas de cada una', () => {
  const l = buildLineas([rep('r1', '2026-10-06', 1, [linea({ horas: 3 }), linea({ horas: 4 })])], [maq({ id: 'b1' })], [], DEF_CFG);
  assert.ok(Math.abs(l[0].exp! - 55.2 * 3) < 0.5);
  assert.ok(Math.abs(l[1].exp! - 55.2 * 4) < 0.5);
});

test('varias órdenes: el paro justificado se descuenta en proporción a las horas', () => {
  const paros: Paro[] = [{ id: 'p', maquina_id: 'b1', causa: 'Mecánico', inicio: new Date(2026, 9, 6, 9, 0).toISOString(), fin: new Date(2026, 9, 6, 10, 0).toISOString(), orden_id: null, nota: null }];
  const l = buildLineas([rep('r1', '2026-10-06', 1, [linea({ horas: 3 }), linea({ horas: 4 })])], [maq({ id: 'b1' })], paros, DEF_CFG);
  assert.ok(Math.abs(l[0].exp! + l[1].exp! - 55.2 * 6) < 0.5);
});
