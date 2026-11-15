// =========================================================
// MOTOR DE REGLAS Y DISPONIBILIDAD — TURNOFLEX · AUTOBOX
// =========================================================

export const LATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const SUCURSALES = [
    { id: 'norte', name: 'AutoBox Norte', zone: 'Zona Norte GBA', address: 'Av. Maipú 2400, Vicente López' },
    { id: 'oeste', name: 'AutoBox Oeste', zone: 'Zona Oeste GBA', address: 'Rivadavia 18500, Morón' },
    { id: 'caba', name: 'AutoBox CABA', zone: 'Ciudad Autónoma de Buenos Aires', address: 'Av. San Juan 2150, CABA' }
];

export const SERVICIOS = [
    { id: 'aceite', name: 'Cambio de aceite y filtros', durationMin: 60, requiresLift: true, price: 45000, deposit: 8000, packEligible: true },
    { id: 'revision', name: 'Revisión general', durationMin: 90, requiresLift: true, price: 62000, deposit: 10000, packEligible: true },
    { id: 'frenos', name: 'Frenos', durationMin: 90, requiresLift: true, price: 88000, deposit: 15000, packEligible: false },
    { id: 'suspension', name: 'Suspensión', durationMin: 120, requiresLift: true, price: 110000, deposit: 18000, packEligible: false },
    { id: 'alineacion', name: 'Alineación y balanceo', durationMin: 60, requiresLift: false, price: 38000, deposit: 7000, packEligible: true },
    { id: 'bateria', name: 'Baterías', durationMin: 45, requiresLift: false, price: 28000, deposit: 5000, packEligible: false },
    { id: 'diagnostico', name: 'Diagnóstico automotor', durationMin: 60, requiresLift: false, price: 35000, deposit: 6000, packEligible: false },
    { id: 'preventivo', name: 'Mantenimiento preventivo', durationMin: 90, requiresLift: true, price: 70000, deposit: 12000, packEligible: true }
];

export const MECANICOS = [
    { id: 'm1', name: 'Diego Rivas', branchId: 'norte', specialties: ['preventivo', 'aceite'], startHour: 8, endHour: 17, commission: 0.35 },
    { id: 'm2', name: 'Sofía Lang', branchId: 'norte', specialties: ['frenos', 'suspension'], startHour: 8, endHour: 17, commission: 0.35 },
    { id: 'm3', name: 'Pablo Núñez', branchId: 'oeste', specialties: ['alineacion', 'bateria'], startHour: 8, endHour: 17, commission: 0.35 },
    { id: 'm4', name: 'Carla Méndez', branchId: 'oeste', specialties: ['diagnostico', 'revision'], startHour: 9, endHour: 18, commission: 0.35 },
    { id: 'm5', name: 'Iván Costa', branchId: 'caba', specialties: ['preventivo', 'frenos'], startHour: 8, endHour: 17, commission: 0.35 },
    { id: 'm6', name: 'Laura Pérez', branchId: 'caba', specialties: ['aceite', 'revision'], startHour: 8, endHour: 16, commission: 0.35 }
];

export const BOXES = [
    { id: 'b1', name: 'Box 1 · Elevador', branchId: 'norte', hasLift: true },
    { id: 'b2', name: 'Box 2 · Rápido', branchId: 'norte', hasLift: false },
    { id: 'b3', name: 'Box 1 · Elevador', branchId: 'oeste', hasLift: true },
    { id: 'b4', name: 'Box 2 · Diagnóstico', branchId: 'oeste', hasLift: false },
    { id: 'b5', name: 'Box 1 · Elevador', branchId: 'caba', hasLift: true },
    { id: 'b6', name: 'Box 2 · Elevador', branchId: 'caba', hasLift: true }
];

export function obtenerSucursal(id) {
    return SUCURSALES.find((b) => b.id === id) || SUCURSALES[0];
}

export function obtenerServicio(idOrName) {
    if (!idOrName) return SERVICIOS[0];
    const limpio = String(idOrName).trim().toLowerCase();
    return (
        SERVICIOS.find((s) => s.id === limpio) ||
        SERVICIOS.find((s) => s.name.toLowerCase() === limpio) ||
        SERVICIOS.find((s) => s.name.toLowerCase().includes(limpio) || limpio.includes(s.id)) ||
        null
    );
}

export function obtenerMecanico(id) {
    return MECANICOS.find((m) => m.id === id) || MECANICOS[0];
}

export function obtenerBox(id) {
    return BOXES.find((b) => b.id === id) || BOXES[0];
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}

export function isBlockingStatus(status) {
    return ['pendiente', 'confirmado', 'en_atencion'].includes(status);
}

export function construirIntervaloTurno(turno) {
    if (turno.inicio && turno.fin) {
        return { start: new Date(turno.inicio), end: new Date(turno.fin) };
    }
    const fecha = turno.fecha || '2026-09-01';
    const hora = turno.hora || '09:00';
    const [h, m] = hora.split(':').map((n) => Number(n) || 0);
    const start = new Date(`${fecha}T00:00:00`);
    start.setHours(h, m, 0, 0);
    const duracion = Number(turno.duracionMin) || 60;
    const end = new Date(start.getTime() + duracion * 60_000);
    return { start, end };
}

export function resourceFree(turnos, mechanicId, boxId, start, end, ignoreId = null) {
    return !turnos.some((apt) => {
        const aptId = apt._id ? apt._id.toString() : apt.id;
        if (ignoreId && aptId === ignoreId.toString()) return false;
        if (apt.activo === false) return false;
        const estado = apt.estado || 'confirmado';
        if (!isBlockingStatus(estado)) return false;
        if (apt.mecanicoId !== mechanicId && apt.boxId !== boxId) return false;
        const { start: aptStart, end: aptEnd } = construirIntervaloTurno(apt);
        return overlaps(start, end, aptStart, aptEnd);
    });
}

function uniqueByStart(slots) {
    const seen = new Set();
    return slots.filter((s) => {
        if (seen.has(s.start)) return false;
        seen.add(s.start);
        return true;
    });
}

export function availabilitySlots({ turnos = [], branchId, serviceId, service, date, ignoreId = null }) {
    const srv = service || obtenerServicio(serviceId) || SERVICIOS[0];
    const mechanics = MECANICOS.filter((m) => m.branchId === branchId);
    const boxes = BOXES.filter((b) => b.branchId === branchId && (!srv.requiresLift || b.hasLift));
    if (!mechanics.length || !boxes.length || !date) return [];

    const slots = [];
    const dayStart = new Date(`${date}T00:00:00`);
    if (Number.isNaN(dayStart.getTime())) return [];

    for (const mechanic of mechanics) {
        for (let hour = mechanic.startHour; hour < mechanic.endHour; hour++) {
            for (const minute of [0, 30]) {
                const start = new Date(dayStart);
                start.setHours(hour, minute, 0, 0);
                const end = new Date(start.getTime() + srv.durationMin * 60_000);
                if (end.getHours() > mechanic.endHour || (end.getHours() === mechanic.endHour && end.getMinutes() > 0)) {
                    continue;
                }
                const box = boxes.find((b) => resourceFree(turnos, mechanic.id, b.id, start, end, ignoreId));
                if (!box) continue;
                const hh = String(hour).padStart(2, '0');
                const mm = String(minute).padStart(2, '0');
                slots.push({
                    hora: `${hh}:${mm}`,
                    start: start.toISOString(),
                    end: end.toISOString(),
                    mechanicId: mechanic.id,
                    mechanicName: mechanic.name,
                    boxId: box.id,
                    boxName: box.name
                });
            }
        }
    }
    slots.sort((a, b) => a.hora.localeCompare(b.hora));
    return uniqueByStart(slots);
}

export function packRemaining(pack) {
    const total = Number(pack.creditosTotales ?? pack.creditsTotal ?? 10);
    const used = Number(pack.creditosUsados ?? pack.creditsUsed ?? 0);
    return Math.max(0, total - used);
}

export function refreshPackStatus(pack, now = new Date()) {
    const estadoActual = pack.estado || pack.status || 'activo';
    if (estadoActual === 'congelado') return estadoActual;
    const remaining = packRemaining(pack);
    if (remaining <= 0) return 'agotado';
    const finStr = pack.fechaFin || pack.end;
    if (finStr && now > new Date(`${finStr}T23:59:59`)) return 'vencido';
    return 'activo';
}

export function canUsePack(pack, fechaStr) {
    const day = String(fechaStr || '').slice(0, 10);
    const estado = pack.estado || pack.status || 'activo';
    const inicio = pack.fechaInicio || pack.start || '0000-01-01';
    const fin = pack.fechaFin || pack.end || '9999-12-31';
    return (
        estado === 'activo' &&
        inicio <= day &&
        day <= fin &&
        packRemaining(pack) > 0
    );
}

export function isLateCancel(turno, now = new Date()) {
    const { start } = construirIntervaloTurno(turno);
    return start.getTime() - now.getTime() <= LATE_WINDOW_MS;
}

export function appointmentLabel(status) {
    const map = {
        pendiente: 'Pendiente',
        confirmado: 'Confirmado',
        cancelado: 'Cancelado',
        cancelacion_tardia: 'Cancelación tardía',
        en_atencion: 'En atención',
        completado: 'Completado',
        no_show: 'No-show'
    };
    return map[status] || status;
}

export function formatMoney(n) {
    return Number(n || 0).toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    });
}

export function formatDate(isoOrDay) {
    if (!isoOrDay) return '';
    const d = isoOrDay.length <= 10 ? new Date(`${isoOrDay}T12:00:00`) : new Date(isoOrDay);
    if (Number.isNaN(d.getTime())) return isoOrDay;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(isoOrTurno) {
    if (!isoOrTurno) return '';
    const d = typeof isoOrTurno === 'string'
        ? new Date(isoOrTurno)
        : construirIntervaloTurno(isoOrTurno).start;
    if (Number.isNaN(d.getTime())) return String(isoOrTurno);
    return d.toLocaleString('es-AR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function mechanicSettlements(turnos, mechanic, fromStr, toStr) {
    const fromDay = String(fromStr || '2026-09-01').slice(0, 10);
    const toDay = String(toStr || '2026-09-15').slice(0, 10);
    const items = turnos.filter((a) => {
        if (a.mecanicoId !== mechanic.id || a.estado !== 'completado') return false;
        const day = a.fecha || (a.inicio ? a.inicio.slice(0, 10) : '');
        return day >= fromDay && day <= toDay;
    });

    const lines = items.map((a) => {
        const service = obtenerServicio(a.servicioId || a.servicio) || { name: a.servicio, price: 45000 };
        const amount = Math.round(service.price * mechanic.commission);
        return { appointment: a, service, amount };
    });

    return {
        mechanic,
        branch: obtenerSucursal(mechanic.branchId),
        lines,
        total: lines.reduce((acc, l) => acc + l.amount, 0)
    };
}

function shiftMonth(day, delta) {
    const d = new Date(`${day}T12:00:00`);
    if (Number.isNaN(d.getTime())) return day;
    d.setMonth(d.getMonth() + delta);
    return d.toISOString().slice(0, 10);
}

export function revenueOf(turnos, packs, fromDay = '2026-08-01', toDay = '2026-12-31') {
    const individual = turnos
        .filter((a) => (a.tipoPago || 'individual') === 'individual')
        .reduce((acc, a) => acc + Number(a.montoPagado || 0), 0);
    const penalties = turnos.reduce((acc, a) => acc + Number(a.seniaPerdida || 0), 0);
    const packSales = packs
        .filter((p) => {
            const day = String(p.pagadoEn || p.fechaInicio || '').slice(0, 10);
            return !day || (day >= fromDay && day <= toDay);
        })
        .reduce((acc, p) => acc + Number(p.montoPagado || 0), 0);

    return {
        individual,
        penalties,
        packs: packSales,
        total: individual + penalties + packSales
    };
}

export function calcularDashboard(turnos, packs, filtros = {}) {
    const from = filtros.desde || '2026-08-01';
    const to = filtros.hasta || '2026-12-31';
    const branchId = filtros.sucursalId || 'todas';
    const serviceId = filtros.servicioId || 'todos';
    const mechanicId = filtros.mecanicoId || 'todos';

    const filtered = turnos.filter((a) => {
        const day = a.fecha || (a.inicio ? a.inicio.slice(0, 10) : '');
        if (day < from || day > to) return false;
        if (branchId !== 'todas' && a.sucursalId !== branchId) return false;
        if (serviceId !== 'todos' && a.servicioId !== serviceId) return false;
        if (mechanicId !== 'todos' && a.mecanicoId !== mechanicId) return false;
        return true;
    });

    const noshow = filtered.filter((a) => a.estado === 'no_show');
    const denom = filtered.filter((a) => !['pendiente', 'cancelado'].includes(a.estado)).length || 1;
    const noshowRate = (noshow.length / denom) * 100;

    const prevFrom = shiftMonth(from, -1);
    const prevTo = shiftMonth(to, -1);
    const prev = turnos.filter((a) => {
        const day = a.fecha || (a.inicio ? a.inicio.slice(0, 10) : '');
        return day >= prevFrom && day <= prevTo;
    });
    const prevDenom = prev.filter((a) => !['pendiente', 'cancelado'].includes(a.estado)).length || 1;
    const prevRate = (prev.filter((a) => a.estado === 'no_show').length / prevDenom) * 100;

    const packUse = packs.reduce(
        (acc, p) => {
            const used = Number(p.creditosUsados || 0);
            const total = Number(p.creditosTotales || 10);
            const status = p.estado || 'activo';
            acc.used += used;
            acc.total += total;
            if (status === 'activo') acc.active += 1;
            if (status === 'congelado') acc.frozen += 1;
            if (status === 'vencido') acc.expiredCredits += Math.max(0, total - used);
            const days = (new Date(`${p.fechaFin}T12:00:00`).getTime() - new Date('2026-09-07T12:00:00').getTime()) / 86400000;
            if (status === 'activo' && days >= 0 && days <= 14) acc.soon += 1;
            acc.available += Math.max(0, total - used);
            return acc;
        },
        { used: 0, total: 0, active: 0, frozen: 0, expiredCredits: 0, soon: 0, available: 0 }
    );

    const revenue = revenueOf(filtered, packs, from, to);
    const prevRevenue = revenueOf(prev, packs, prevFrom, prevTo);

    const byBranch = SUCURSALES.map((b) => ({
        id: b.id,
        name: b.name.replace('AutoBox ', ''),
        fullName: b.name,
        value: revenueOf(
            filtered.filter((a) => a.sucursalId === b.id),
            branchId === 'todas' || branchId === b.id ? [] : [],
            from,
            to
        ).total
    }));
    const maxRev = Math.max(...byBranch.map((x) => x.value), 1);

    const months = ['08', '09', '10', '11'];
    const noshowSeries = months.map((m) => {
        const subset = turnos.filter((a) => (a.fecha || '').startsWith(`2026-${m}`));
        const d = subset.filter((a) => !['pendiente', 'cancelado'].includes(a.estado)).length || 1;
        return { m: `${m}/2026`, v: (subset.filter((a) => a.estado === 'no_show').length / d) * 100 };
    });

    const serviceCounts = {};
    for (const a of filtered) {
        const key = a.servicioId || a.servicio || 'aceite';
        serviceCounts[key] = (serviceCounts[key] || 0) + 1;
    }
    const topServices = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({
            id,
            name: obtenerServicio(id)?.name || id,
            count
        }));

    return {
        filtros: { desde: from, hasta: to, sucursalId: branchId, servicioId: serviceId, mecanicoId: mechanicId },
        filteredCount: filtered.length,
        noshowCount: noshow.length,
        noshowRate,
        prevRate,
        packUse,
        packPct: packUse.total ? Math.round((packUse.used / packUse.total) * 100) : 0,
        revenue,
        prevRevenue,
        byBranch,
        maxRev,
        noshowSeries,
        topServices
    };
}

export async function registrarAuditoria(actor, accion, detalle) {
    try {
        const { default: Auditoria } = await import('../models/Auditoria.js');
        await Auditoria.create({
            actor: actor || 'sistema',
            accion,
            detalle,
            fecha: new Date()
        });
    } catch (err) {
        console.error('Error al registrar auditoría:', err.message);
    }
}

export async function sincronizarPacksDB() {
    const [{ default: Pack }, { default: Turno }] = await Promise.all([
        import('../models/Pack.js'),
        import('../models/Turno.js')
    ]);
    const [packs, turnos] = await Promise.all([
        Pack.find({ activo: true }),
        Turno.find({ packId: { $ne: null } }).lean()
    ]);

    const estadosQueConsumen = ['pendiente', 'confirmado', 'en_atencion', 'completado', 'cancelacion_tardia', 'no_show'];

    for (const pack of packs) {
        const usados = turnos.filter(
            (t) => t.packId && t.packId.toString() === pack._id.toString() && estadosQueConsumen.includes(t.estado)
        ).length;
        pack.creditosUsados = usados;
        pack.estado = refreshPackStatus(pack);
        await pack.save();
    }
}

export async function siguienteCodigoTurno() {
    const { default: Turno } = await import('../models/Turno.js');
    const total = await Turno.countDocuments();
    return `AB-${String(total + 1).padStart(5, '0')}`;
}

export async function cargarSemillaTurnoFlex({ forzar = false } = {}) {
    const [
        { default: Cliente },
        { default: Vehiculo },
        { default: Turno },
        { default: Pack },
        { default: Congelamiento },
        { default: Excepcion },
        { default: Auditoria },
        { default: Alerta }
    ] = await Promise.all([
        import('../models/Cliente.js'),
        import('../models/Vehiculo.js'),
        import('../models/Turno.js'),
        import('../models/Pack.js'),
        import('../models/Congelamiento.js'),
        import('../models/Excepcion.js'),
        import('../models/Auditoria.js'),
        import('../models/Alerta.js')
    ]);

    if (!forzar) {
        const clientesCount = await Cliente.countDocuments();
        if (clientesCount > 0) return { creado: false };
    } else {
        await Promise.all([
            Turno.deleteMany({}),
            Pack.deleteMany({}),
            Congelamiento.deleteMany({}),
            Excepcion.deleteMany({}),
            Auditoria.deleteMany({}),
            Alerta.deleteMany({}),
            Vehiculo.deleteMany({}),
            Cliente.deleteMany({})
        ]);
    }

    const c1 = await Cliente.create({
        nombre: 'Ana',
        apellido: 'Gómez',
        telefono: '11-4555-0101',
        email: 'ana.gomez@mail.com',
        tipo: 'particular'
    });
    const c2 = await Cliente.create({
        nombre: 'Martín',
        apellido: 'Duarte',
        telefono: '11-4555-0102',
        email: 'mduarte@mail.com',
        tipo: 'particular'
    });
    const c3 = await Cliente.create({
        nombre: 'Flota',
        apellido: 'ABC',
        telefono: '11-4555-0103',
        email: 'flota@distribuidoraabc.com',
        tipo: 'flota',
        empresa: 'Distribuidora ABC'
    });
    const c4 = await Cliente.create({
        nombre: 'Reparto',
        apellido: 'Sur',
        telefono: '11-4555-0104',
        email: 'ops@repartosur.com',
        tipo: 'flota',
        empresa: 'Reparto Sur'
    });

    const [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10] = await Promise.all([
        Vehiculo.create({ clienteId: c1._id, patente: 'AB 123 CD', marca: 'Volkswagen', modelo: 'Gol Trend', anio: 2016 }),
        Vehiculo.create({ clienteId: c1._id, patente: 'AD 890 EF', marca: 'Toyota', modelo: 'Etios', anio: 2019 }),
        Vehiculo.create({ clienteId: c2._id, patente: 'AF 445 GH', marca: 'Ford', modelo: 'Focus', anio: 2014 }),
        Vehiculo.create({ clienteId: c3._id, patente: 'AA 101 FL', marca: 'Fiat', modelo: 'Fiorino', anio: 2018 }),
        Vehiculo.create({ clienteId: c3._id, patente: 'AA 102 FL', marca: 'Fiat', modelo: 'Fiorino', anio: 2018 }),
        Vehiculo.create({ clienteId: c3._id, patente: 'AA 103 FL', marca: 'Peugeot', modelo: 'Partner', anio: 2017 }),
        Vehiculo.create({ clienteId: c3._id, patente: 'AA 104 FL', marca: 'Renault', modelo: 'Kangoo', anio: 2015 }),
        Vehiculo.create({ clienteId: c3._id, patente: 'AA 105 FL', marca: 'Fiat', modelo: 'Fiorino', anio: 2020 }),
        Vehiculo.create({ clienteId: c3._id, patente: 'AA 106 FL', marca: 'Citroën', modelo: 'Berlingo', anio: 2016 }),
        Vehiculo.create({ clienteId: c4._id, patente: 'AC 220 RS', marca: 'Chevrolet', modelo: 'Montana', anio: 2013 })
    ]);

    const [p1, p2, p3] = await Promise.all([
        Pack.create({
            clienteId: c3._id,
            nombre: 'Pack Flota 10',
            creditosTotales: 10,
            creditosUsados: 4,
            fechaInicio: '2026-08-01',
            fechaFin: '2026-12-31',
            estado: 'activo',
            montoPagado: 520000,
            pagadoEn: '2026-08-01T12:00:00'
        }),
        Pack.create({
            clienteId: c4._id,
            nombre: 'Pack Flota 10',
            creditosTotales: 10,
            creditosUsados: 8,
            fechaInicio: '2026-07-01',
            fechaFin: '2026-08-31',
            estado: 'vencido',
            montoPagado: 520000,
            pagadoEn: '2026-07-01T12:00:00'
        }),
        Pack.create({
            clienteId: c3._id,
            nombre: 'Pack Flota 10 · Q4',
            creditosTotales: 10,
            creditosUsados: 0,
            fechaInicio: '2026-10-01',
            fechaFin: '2026-12-31',
            estado: 'activo',
            montoPagado: 520000,
            pagadoEn: '2026-09-02T10:00:00'
        })
    ]);

    const crearDatoTurno = (codigo, cliente, vehiculo, servicioId, sucursalId, mecanicoId, boxId, fecha, horaNum, estado, tipoPago, montoPagado, pack = null, seniaPerdida = 0) => {
        const srv = obtenerServicio(servicioId);
        const hora = `${String(horaNum).padStart(2, '0')}:00`;
        const start = new Date(`${fecha}T${hora}:00`);
        const end = new Date(start.getTime() + srv.durationMin * 60_000);
        const activo = !['cancelado', 'cancelacion_tardia'].includes(estado);
        return {
            codigo,
            clienteId: cliente._id,
            vehiculoId: vehiculo._id,
            servicio: srv.name,
            servicioId: srv.id,
            sucursalId,
            mecanicoId,
            boxId,
            fecha,
            hora,
            duracionMin: srv.durationMin,
            inicio: start.toISOString(),
            fin: end.toISOString(),
            estado,
            tipoPago,
            packId: pack ? pack._id : null,
            montoPagado,
            seniaPerdida,
            activo
        };
    };

    const turnosSemilla = [
        crearDatoTurno('AB-00001', c1, v1, 'aceite', 'norte', 'm1', 'b1', '2026-08-12', 9, 'completado', 'individual', 45000),
        crearDatoTurno('AB-00002', c1, v1, 'revision', 'norte', 'm2', 'b1', '2026-08-28', 10, 'no_show', 'individual', 10000, null, 10000),
        crearDatoTurno('AB-00003', c2, v3, 'frenos', 'oeste', 'm3', 'b3', '2026-08-18', 11, 'completado', 'individual', 88000),
        crearDatoTurno('AB-00004', c3, v4, 'preventivo', 'norte', 'm1', 'b1', '2026-08-05', 8, 'completado', 'pack', 0, p1),
        crearDatoTurno('AB-00005', c3, v5, 'aceite', 'norte', 'm1', 'b1', '2026-08-14', 14, 'completado', 'pack', 0, p1),
        crearDatoTurno('AB-00006', c3, v6, 'alineacion', 'oeste', 'm3', 'b4', '2026-08-20', 9, 'completado', 'pack', 0, p1),
        crearDatoTurno('AB-00007', c3, v7, 'preventivo', 'caba', 'm5', 'b5', '2026-08-26', 10, 'completado', 'pack', 0, p1),
        crearDatoTurno('AB-00008', c4, v10, 'revision', 'oeste', 'm4', 'b3', '2026-08-10', 9, 'completado', 'pack', 0, p2),
        crearDatoTurno('AB-00009', c2, v3, 'diagnostico', 'oeste', 'm4', 'b4', '2026-09-02', 15, 'cancelacion_tardia', 'individual', 0, null, 6000),
        crearDatoTurno('AB-00010', c1, v2, 'bateria', 'caba', 'm6', 'b5', '2026-09-03', 11, 'completado', 'individual', 28000),
        crearDatoTurno('AB-00011', c3, v8, 'preventivo', 'norte', 'm1', 'b1', '2026-09-08', 9, 'confirmado', 'pack', 0, p1),
        crearDatoTurno('AB-00012', c1, v1, 'alineacion', 'norte', 'm2', 'b2', '2026-09-09', 10, 'confirmado', 'individual', 7000),
        crearDatoTurno('AB-00013', c3, v9, 'aceite', 'caba', 'm6', 'b6', '2026-09-10', 8, 'confirmado', 'pack', 0, p1),
        crearDatoTurno('AB-00014', c2, v3, 'suspension', 'oeste', 'm3', 'b3', '2026-09-04', 8, 'no_show', 'individual', 0, null, 18000),
        crearDatoTurno('AB-00015', c1, v2, 'revision', 'caba', 'm5', 'b5', '2026-09-01', 9, 'completado', 'individual', 62000),
        crearDatoTurno('AB-00016', c4, v10, 'aceite', 'oeste', 'm3', 'b3', '2026-08-22', 13, 'cancelado', 'individual', 0),
        crearDatoTurno('AB-00017', c3, v4, 'preventivo', 'norte', 'm2', 'b1', '2026-09-11', 14, 'pendiente', 'pack', 0, p1),
        crearDatoTurno('AB-00018', c1, v1, 'diagnostico', 'norte', 'm1', 'b2', '2026-09-07', 15, 'en_atencion', 'individual', 35000)
    ];

    const turnosInsertados = await Turno.insertMany(turnosSemilla);
    const a12 = turnosInsertados.find((t) => t.codigo === 'AB-00012');

    await Congelamiento.create({
        packId: p2._id,
        solicitadoPor: 'Distribuidora ABC',
        aprobadoPor: 'Jorge Palacios',
        dias: 15,
        motivo: 'Parada de flota por recambio de seguros',
        estado: 'rechazado'
    });

    await Excepcion.create({
        solicitadoPor: 'Diego Rivas',
        sucursalId: 'norte',
        motivo: 'Cliente habitual pide sobreturno. Hay elevador ocupado a las 17.',
        estado: 'pendiente'
    });

    await Auditoria.create({
        actor: 'Elena Varela (Gerencia)',
        accion: 'sistema',
        detalle: 'Semilla inicial TurnoFlex AutoBox',
        fecha: new Date('2026-09-07T10:00:00')
    });

    await Alerta.insertMany([
        {
            canal: 'portal',
            destinatario: 'ana.gomez@mail.com',
            tipo: 'turno_24h',
            mensaje: 'Recordatorio turno AB-00012 · 09/09 10:00 Norte',
            resultado: 'enviado',
            turnoId: a12?._id || null,
            fecha: new Date('2026-09-07T08:00:00')
        },
        {
            canal: 'email',
            destinatario: 'flota@distribuidoraabc.com',
            tipo: 'pack_7d',
            mensaje: 'Pack Flota 10 vence pronto · créditos restantes disponibles',
            resultado: 'enviado',
            packId: p1._id,
            fecha: new Date('2026-09-06T09:00:00')
        }
    ]);

    await sincronizarPacksDB();
    return { creado: true };
}

