import Cliente from '../models/Cliente.js';
import Turno from '../models/Turno.js';
import Pack from '../models/Pack.js';
import Congelamiento from '../models/Congelamiento.js';
import Excepcion from '../models/Excepcion.js';
import Auditoria from '../models/Auditoria.js';
import Alerta from '../models/Alerta.js';
import {
    SUCURSALES,
    SERVICIOS,
    MECANICOS,
    BOXES,
    refreshPackStatus,
    sincronizarPacksDB,
    registrarAuditoria,
    mechanicSettlements,
    calcularDashboard,
    cargarSemillaTurnoFlex
} from '../services/turnoflexEngine.js';

// ==========================================
// CATÁLOGOS TURNOFLEX
// ==========================================
export const obtenerCatalogos = (req, res) => {
    res.json({
        sucursales: SUCURSALES,
        servicios: SERVICIOS,
        mecanicos: MECANICOS,
        boxes: BOXES
    });
};

// ==========================================
// PACKS Y CONGELAMIENTOS
// ==========================================
export const listarPacks = async (req, res, next) => {
    try {
        await sincronizarPacksDB();
        const packs = await Pack.find({ activo: true })
            .populate('clienteId', 'nombre apellido email tipo empresa')
            .sort({ createdAt: -1 });
        const congelamientos = await Congelamiento.find()
            .populate({ path: 'packId', populate: { path: 'clienteId', select: 'nombre apellido empresa' } })
            .sort({ createdAt: -1 });
        res.json({ packs, congelamientos });
    } catch (error) {
        next(error);
    }
};

export const crearPack = async (req, res, next) => {
    try {
        const {
            clienteId,
            nombre = 'Pack Flota 10',
            creditosTotales = 10,
            fechaInicio,
            fechaFin,
            montoPagado = 520000
        } = req.body;

        const cliente = await Cliente.findOne({ _id: clienteId, activo: true });
        if (!cliente) {
            return res.status(400).json({ mensaje: 'El cliente seleccionado no existe o está inactivo.' });
        }

        const hoy = new Date().toISOString().slice(0, 10);
        const inicio = fechaInicio || hoy;
        let fin = fechaFin;
        if (!fin) {
            const d = new Date(`${inicio}T12:00:00`);
            d.setDate(d.getDate() + 60);
            fin = d.toISOString().slice(0, 10);
        }

        const nuevoPack = await Pack.create({
            clienteId,
            nombre: nombre.trim(),
            creditosTotales: Number(creditosTotales) || 10,
            creditosUsados: 0,
            fechaInicio: inicio,
            fechaFin: fin,
            estado: 'activo',
            montoPagado: Number(montoPagado) || 520000,
            pagadoEn: new Date().toISOString()
        });

        await registrarAuditoria(
            req.usuario?.nombre || req.usuario?.username || 'sistema',
            'pack',
            `Alta de ${nuevoPack.nombre} para ${cliente.empresa || `${cliente.nombre} ${cliente.apellido}`} (${nuevoPack.creditosTotales} créditos)`
        );

        res.status(201).json({
            mensaje: 'Pack contratado con éxito',
            pack: nuevoPack
        });
    } catch (error) {
        next(error);
    }
};

export const solicitarCongelamiento = async (req, res, next) => {
    try {
        const packId = req.params.id || req.body.packId;
        const { dias = 7, motivo = 'Parada operativa de la flota' } = req.body;

        const pack = await Pack.findOne({ _id: packId, activo: true }).populate('clienteId', 'nombre apellido empresa');
        if (!pack) {
            return res.status(404).json({ mensaje: 'Pack no encontrado' });
        }

        const diasNum = Number(dias);
        if (!diasNum || diasNum < 1 || diasNum > 30) {
            return res.status(400).json({ mensaje: 'Los días de congelamiento deben estar entre 1 y 30.' });
        }

        const solicitante =
            req.usuario?.nombre ||
            pack.clienteId?.empresa ||
            (pack.clienteId ? `${pack.clienteId.nombre} ${pack.clienteId.apellido}` : 'Cliente');

        const congelamiento = await Congelamiento.create({
            packId: pack._id,
            solicitadoPor: solicitante,
            dias: diasNum,
            motivo: motivo.trim() || 'Parada operativa de la flota',
            estado: 'pendiente'
        });

        await registrarAuditoria(
            solicitante,
            'congelamiento',
            `Solicitud de congelamiento para ${pack.nombre} (${diasNum} días: ${motivo.trim()})`
        );

        res.status(201).json({
            mensaje: 'Solicitud de congelamiento enviada a coordinación',
            congelamiento
        });
    } catch (error) {
        next(error);
    }
};

export const resolverCongelamiento = async (req, res, next) => {
    try {
        const { id } = req.params;
        const aprobar = req.body.aprobar === true || req.body.aprobar === 'true' || req.body.accion === 'aprobar';

        const freeze = await Congelamiento.findById(id);
        if (!freeze) {
            return res.status(404).json({ mensaje: 'Solicitud de congelamiento no encontrada' });
        }

        const pack = await Pack.findById(freeze.packId);
        let nuevaFechaFin = '';

        if (aprobar && pack) {
            const end = new Date(`${pack.fechaFin}T12:00:00`);
            end.setDate(end.getDate() + Number(freeze.dias || 0));
            nuevaFechaFin = end.toISOString().slice(0, 10);
            pack.fechaFin = nuevaFechaFin;
            pack.estado = refreshPackStatus({ ...pack.toObject(), fechaFin: nuevaFechaFin, estado: 'activo' });
            await pack.save();
        }

        const actor = req.usuario?.nombre || req.usuario?.username || 'Coordinación';
        freeze.estado = aprobar ? 'aprobado' : 'rechazado';
        freeze.aprobadoPor = actor;
        if (nuevaFechaFin) freeze.nuevaFechaFin = nuevaFechaFin;
        await freeze.save();

        await registrarAuditoria(
            actor,
            'congelamiento',
            `${aprobar ? 'Aprobado' : 'Rechazado'} ${pack?.nombre || freeze.packId} (${freeze.dias} días)${nuevaFechaFin ? ` → nuevo vencimiento ${nuevaFechaFin}` : ''}`
        );

        res.json({
            mensaje: aprobar
                ? `Congelamiento aprobado. Nueva vigencia hasta ${nuevaFechaFin}.`
                : 'Solicitud de congelamiento rechazada.',
            congelamiento: freeze,
            pack
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// EXCEPCIONES DE TALLER Y COORDINACIÓN
// ==========================================
export const listarExcepciones = async (req, res, next) => {
    try {
        const excepciones = await Excepcion.find().sort({ createdAt: -1 });
        res.json(excepciones);
    } catch (error) {
        next(error);
    }
};

export const solicitarExcepcion = async (req, res, next) => {
    try {
        const { motivo, sucursalId = 'norte', solicitadoPor } = req.body;
        if (!motivo || !motivo.trim()) {
            return res.status(400).json({ mensaje: 'Debe indicar el motivo de la excepción.' });
        }

        const autor = solicitadoPor?.trim() || req.usuario?.nombre || req.usuario?.username || 'Mecánico de Taller';
        const excepcion = await Excepcion.create({
            solicitadoPor: autor,
            sucursalId,
            motivo: motivo.trim(),
            estado: 'pendiente'
        });

        await registrarAuditoria(
            autor,
            'excepcion',
            `Pedido de excepción en sucursal ${sucursalId}: ${motivo.trim()}`
        );

        res.status(201).json({
            mensaje: 'Pedido de excepción enviado a coordinación',
            excepcion
        });
    } catch (error) {
        next(error);
    }
};

export const resolverExcepcion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const aprobar = req.body.aprobar === true || req.body.aprobar === 'true' || req.body.accion === 'aprobar';

        const excepcion = await Excepcion.findById(id);
        if (!excepcion) {
            return res.status(404).json({ mensaje: 'Excepción no encontrada' });
        }

        const actor = req.usuario?.nombre || req.usuario?.username || 'Coordinación';
        excepcion.estado = aprobar ? 'aprobada' : 'rechazada';
        excepcion.resueltoPor = actor;
        await excepcion.save();

        await registrarAuditoria(
            actor,
            'excepcion',
            `Excepción ${aprobar ? 'autorizada y registrada' : 'rechazada'} (${excepcion.solicitadoPor}): ${excepcion.motivo}`
        );

        res.json({
            mensaje: aprobar ? 'Excepción autorizada y registrada' : 'Excepción rechazada',
            excepcion
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// LIQUIDACIONES QUINCENALES
// ==========================================
export const obtenerLiquidaciones = async (req, res, next) => {
    try {
        const desde = req.query.desde || '2026-08-01';
        const hasta = req.query.hasta || '2026-09-30';
        const turnos = await Turno.find({ estado: 'completado' })
            .populate('clienteId', 'nombre apellido empresa')
            .populate('vehiculoId', 'patente marca modelo')
            .lean();

        const liquidaciones = MECANICOS.map((m) => mechanicSettlements(turnos, m, desde, hasta));
        res.json({ desde, hasta, liquidaciones });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// DASHBOARD DE GESTIÓN
// ==========================================
export const obtenerDashboard = async (req, res, next) => {
    try {
        await sincronizarPacksDB();
        const [turnos, packs] = await Promise.all([
            Turno.find().lean(),
            Pack.find({ activo: true }).populate('clienteId', 'nombre apellido empresa').lean()
        ]);
        const datos = calcularDashboard(turnos, packs, req.query);
        if (req.usuario?.rol === 'recepcion') {
            delete datos.revenue;
            delete datos.prevRevenue;
        }
        res.json(datos);
    } catch (error) {
        next(error);
    }
};

// ==========================================
// AUDITORÍA, ALERTAS Y SEMILLA DEMO
// ==========================================
export const obtenerAuditoriaYAlertas = async (req, res, next) => {
    try {
        const [auditoria, alertas] = await Promise.all([
            Auditoria.find().sort({ fecha: -1, createdAt: -1 }).limit(100).lean(),
            Alerta.find().sort({ fecha: -1, createdAt: -1 }).limit(100).lean()
        ]);
        res.json({ auditoria, alertas });
    } catch (error) {
        next(error);
    }
};

export const generarAlertasPendientes = async (req, res, next) => {
    try {
        await sincronizarPacksDB();
        const [turnosConfirmados, packsActivos] = await Promise.all([
            Turno.find({ activo: true, estado: { $in: ['pendiente', 'confirmado'] } })
                .populate('clienteId', 'nombre apellido email')
                .lean(),
            Pack.find({ activo: true, estado: 'activo' })
                .populate('clienteId', 'nombre apellido email empresa')
                .lean()
        ]);

        let generadas = 0;
        for (const t of turnosConfirmados) {
            const yaExiste = await Alerta.exists({ turnoId: t._id, tipo: 'turno_24h' });
            if (!yaExiste && t.clienteId?.email) {
                await Alerta.create({
                    canal: 'portal',
                    destinatario: t.clienteId.email,
                    tipo: 'turno_24h',
                    mensaje: `Recordatorio turno ${t.codigo || t._id.toString().slice(-6)} · ${t.fecha} ${t.hora} (${t.sucursalId || 'norte'})`,
                    resultado: 'enviado',
                    turnoId: t._id
                });
                generadas++;
            }
        }

        for (const p of packsActivos) {
            const restantes = Math.max(0, (p.creditosTotales || 10) - (p.creditosUsados || 0));
            const yaExiste = await Alerta.exists({ packId: p._id, tipo: 'pack_7d' });
            if (!yaExiste && p.clienteId?.email) {
                await Alerta.create({
                    canal: 'email',
                    destinatario: p.clienteId.email,
                    tipo: 'pack_7d',
                    mensaje: `${p.nombre} vence el ${p.fechaFin} · ${restantes} créditos restantes`,
                    resultado: 'enviado',
                    packId: p._id
                });
                generadas++;
            }
        }

        await registrarAuditoria(
            req.usuario?.nombre || req.usuario?.username || 'sistema',
            'sistema',
            `Ejecución de motor de alertas (${generadas} nuevas alertas emitidas)`
        );

        res.json({ mensaje: `Se verificaron recordatorios y se emitieron ${generadas} alertas.`, generadas });
    } catch (error) {
        next(error);
    }
};

export const resetearDemoTurnoFlex = async (req, res, next) => {
    try {
        await cargarSemillaTurnoFlex({ forzar: true });
        res.json({ mensaje: 'Datos de demostración de TurnoFlex · AutoBox restaurados con éxito.' });
    } catch (error) {
        next(error);
    }
};
