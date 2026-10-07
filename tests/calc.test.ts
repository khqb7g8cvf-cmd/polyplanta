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

const mat: Material = { id: 'x', nombre: 'PEBD', categoria: 'resina', kg_por_saco: 25, minimo_kg: 1000, activo: true };
const mv = (o: Partial<Movimiento>): Movimiento => ({ id: Math.random() + '', material_id: 'x', tipo: 'salida', fecha: '2026-10-05T10:00:00', delta_kg: -300, sacos: null, lote: null, proveedor: null, factura: null, costo_kg: null, maquina_id: null, orden_id: null, nota: null, ...o });

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
