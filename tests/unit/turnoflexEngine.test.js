import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    SUCURSALES,
    SERVICIOS,
    MECANICOS,
    obtenerServicio,
    overlaps,
    resourceFree,
    availabilitySlots,
    packRemaining,
    refreshPackStatus,
    canUsePack,
    isLateCancel,
    mechanicSettlements,
    calcularDashboard
} from '../../services/turnoflexEngine.js';

describe('turnoflexEngine (reglas de negocio TurnoFlex · AutoBox)', () => {
    it('dispone de las 3 sucursales, 8 servicios y 6 mecánicos del caso AutoBox', () => {
        assert.equal(SUCURSALES.length, 3);
        assert.equal(SERVICIOS.length, 8);
        assert.equal(MECANICOS.length, 6);
    });

    it('overlaps detecta solapamiento de intervalos horarios', () => {
        const a1 = new Date('2026-09-12T09:00:00');
        const a2 = new Date('2026-09-12T10:30:00');
        const b1 = new Date('2026-09-12T10:00:00');
        const b2 = new Date('2026-09-12T11:00:00');
        const c1 = new Date('2026-09-12T10:30:00');
        const c2 = new Date('2026-09-12T11:30:00');

        assert.equal(overlaps(a1, a2, b1, b2), true);
        assert.equal(overlaps(a1, a2, c1, c2), false);
    });

    it('availabilitySlots exige box con elevador cuando el servicio lo requiere y excluye horarios ocupados', () => {
        const srvFrenos = obtenerServicio('frenos'); // 90 min, requiere elevador
        const turnosExistentes = [
            {
                _id: 't1',
                fecha: '2026-09-12',
                hora: '08:00',
                duracionMin: 90,
                mecanicoId: 'm1',
                boxId: 'b1', // único box con elevador en Norte
                estado: 'confirmado',
                activo: true
            }
        ];

        const slots = availabilitySlots({
            turnos: turnosExistentes,
            branchId: 'norte',
            service: srvFrenos,
            date: '2026-09-12'
        });

        // Entre 08:00 y 09:30 el único box con elevador (b1) está ocupado en Norte
        assert.equal(slots.some((s) => s.hora === '08:00'), false);
        assert.equal(slots.some((s) => s.hora === '08:30'), false);
        assert.equal(slots.some((s) => s.hora === '09:00'), false);
        // A las 09:30 b1 vuelve a estar libre
        assert.equal(slots.some((s) => s.hora === '09:30'), true);
    });

    it('isLateCancel aplica la regla de las 24 horas', () => {
        const ahora = new Date('2026-09-10T10:00:00');
        const turnoEn12h = { fecha: '2026-09-10', hora: '22:00', duracionMin: 60 };
        const turnoEn48h = { fecha: '2026-09-12', hora: '10:00', duracionMin: 60 };

        assert.equal(isLateCancel(turnoEn12h, ahora), true);
        assert.equal(isLateCancel(turnoEn48h, ahora), false);
    });

    it('Pack Flota 10: calcula saldo, vigencia y elegibilidad', () => {
        const pack = {
            creditosTotales: 10,
            creditosUsados: 4,
            fechaInicio: '2026-08-01',
            fechaFin: '2026-09-30',
            estado: 'activo'
        };
        assert.equal(packRemaining(pack), 6);
        assert.equal(canUsePack(pack, '2026-09-15'), true);
        assert.equal(canUsePack(pack, '2026-10-05'), false);

        const packAgotado = { ...pack, creditosUsados: 10 };
        assert.equal(refreshPackStatus(packAgotado, new Date('2026-09-10')), 'agotado');

        const packVencido = { ...pack, creditosUsados: 2 };
        assert.equal(refreshPackStatus(packVencido, new Date('2026-10-10')), 'vencido');
    });

    it('mechanicSettlements liquida solo servicios completados en el período', () => {
        const diego = MECANICOS.find((m) => m.id === 'm1'); // 35% comisión
        const turnos = [
            { _id: '1', codigo: 'AB-00001', mecanicoId: 'm1', servicioId: 'aceite', fecha: '2026-09-05', estado: 'completado' },
            { _id: '2', codigo: 'AB-00002', mecanicoId: 'm1', servicioId: 'frenos', fecha: '2026-09-06', estado: 'no_show' },
            { _id: '3', codigo: 'AB-00003', mecanicoId: 'm1', servicioId: 'revision', fecha: '2026-09-07', estado: 'cancelado' }
        ];
        const liq = mechanicSettlements(turnos, diego, '2026-09-01', '2026-09-15');
        assert.equal(liq.lines.length, 1);
        assert.equal(liq.total, Math.round(45000 * 0.35));
    });

    it('calcularDashboard calcula no-show, uso de packs y recaudación sin duplicar packs', () => {
        const turnos = [
            { fecha: '2026-09-01', sucursalId: 'norte', servicioId: 'aceite', mecanicoId: 'm1', estado: 'completado', tipoPago: 'individual', montoPagado: 45000, seniaPerdida: 0 },
            { fecha: '2026-09-02', sucursalId: 'norte', servicioId: 'preventivo', mecanicoId: 'm1', estado: 'completado', tipoPago: 'pack', montoPagado: 0, seniaPerdida: 0 },
            { fecha: '2026-09-03', sucursalId: 'norte', servicioId: 'revision', mecanicoId: 'm2', estado: 'no_show', tipoPago: 'individual', montoPagado: 0, seniaPerdida: 10000 }
        ];
        const packs = [
            { creditosTotales: 10, creditosUsados: 5, fechaInicio: '2026-08-01', fechaFin: '2026-09-30', estado: 'activo', montoPagado: 520000, pagadoEn: '2026-08-15' }
        ];

        const dash = calcularDashboard(turnos, packs, { desde: '2026-08-01', hasta: '2026-09-30' });
        assert.equal(dash.noshowCount, 1);
        assert.equal(dash.packPct, 50);
        // 45000 (individual) + 10000 (penalización) + 520000 (venta del pack, sin sumar el turno de pack)
        assert.equal(dash.revenue.total, 575000);
    });
});
