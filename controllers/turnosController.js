import Turno from '../models/Turno.js';
import Cliente from '../models/Cliente.js';
import Vehiculo from '../models/Vehiculo.js';
import Pack from '../models/Pack.js';
import {
    SERVICIOS,
    obtenerServicio,
    availabilitySlots,
    resourceFree,
    canUsePack,
    isLateCancel,
    appointmentLabel,
    sincronizarPacksDB,
    registrarAuditoria,
    siguienteCodigoTurno
} from '../services/turnoflexEngine.js';

// LISTAR TURNOS ACTIVOS
export const listarTurnos = async (req, res, next) => {
    try {
        const turnos = await Turno.find({ activo: true })
            .populate('clienteId', 'nombre apellido tipo empresa email')
            .populate('vehiculoId', 'patente marca modelo anio')
            .populate('packId', 'nombre estado creditosTotales creditosUsados')
            .sort({ fecha: 1, hora: 1 });
        res.json(turnos);
    } catch (error) {
        next(error);
    }
};

// CONSULTAR DISPONIBILIDAD (MOTOR TURNOFLEX)
export const consultarDisponibilidad = async (req, res, next) => {
    try {
        const { sucursalId = 'norte', servicioId = 'aceite', fecha, ignoreId } = req.query;
        if (!fecha) {
            return res.status(400).json({ mensaje: 'La fecha es obligatoria para consultar disponibilidad' });
        }
        const srv = obtenerServicio(servicioId) || SERVICIOS[0];
        const turnosDia = await Turno.find({ fecha, activo: true }).lean();
        const slots = availabilitySlots({
            turnos: turnosDia,
            branchId: sucursalId,
            service: srv,
            date: fecha,
            ignoreId
        });
        res.json({ sucursalId, servicio: srv, fecha, slots });
    } catch (error) {
        next(error);
    }
};

// CONSULTAR TURNO POR ID
export const consultarTurnoPorId = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ _id: req.params.id, activo: true })
            .populate('clienteId', 'nombre apellido telefono email tipo empresa')
            .populate('vehiculoId', 'patente marca modelo anio')
            .populate('packId', 'nombre estado creditosTotales creditosUsados fechaFin');
        if (!turno) {
            return res.status(404).json({ mensaje: 'Turno no encontrado o cancelado' });
        }
        res.json(turno);
    } catch (error) {
        next(error);
    }
};

// CREAR TURNO
export const crearTurno = async (req, res, next) => {
    try {
        const {
            clienteId,
            vehiculoId,
            fecha,
            hora,
            servicio,
            servicioId,
            sucursalId,
            mecanicoId,
            boxId,
            tipoPago,
            packId
        } = req.body;

        // Validar existencia de cliente activo
        const clienteExiste = await Cliente.findOne({ _id: clienteId, activo: true });
        if (!clienteExiste) {
            return res.status(400).json({ mensaje: 'El cliente seleccionado no existe o está inactivo' });
        }

        // Validar existencia de vehículo activo
        const vehiculo = await Vehiculo.findOne({ _id: vehiculoId, activo: true });
        if (!vehiculo) {
            return res.status(400).json({ mensaje: 'El vehículo seleccionado no existe o está inactivo' });
        }

        // Verificar que el vehículo pertenezca al cliente indicado
        if (vehiculo.clienteId.toString() !== clienteId.toString()) {
            return res.status(400).json({
                mensaje: 'El vehículo seleccionado no pertenece al cliente indicado'
            });
        }

        const srvCatalogo = obtenerServicio(servicioId || servicio);
        const nombreServicio = servicio?.trim() || srvCatalogo?.name || '';
        const idServicio = srvCatalogo?.id || servicioId || 'aceite';
        const duracionMin = srvCatalogo?.durationMin || 60;
        const sucId = sucursalId || 'norte';
        const mecId = mecanicoId || 'm1';
        const bxId = boxId || 'b1';
        const modalidadPago = tipoPago === 'pack' ? 'pack' : 'individual';

        let packValido = null;
        let montoPagado = srvCatalogo ? srvCatalogo.deposit : 8000;

        if (modalidadPago === 'pack') {
            if (!packId) {
                return res.status(400).json({ mensaje: 'Debe seleccionar un pack activo para usar un crédito.' });
            }
            await sincronizarPacksDB();
            packValido = await Pack.findOne({ _id: packId, clienteId, activo: true });
            if (!packValido || !canUsePack(packValido, fecha) || (srvCatalogo && !srvCatalogo.packEligible)) {
                return res.status(400).json({
                    mensaje: 'Ese crédito no se puede usar: el pack no está vigente, no tiene saldo o el servicio no está incluido.'
                });
            }
            montoPagado = 0;
        }

        // Calcular intervalo horario si la fecha y hora tienen formato válido
        let inicioIso = '';
        let finIso = '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || '')) && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora || '').trim())) {
            const [hh, mm] = String(hora).trim().split(':').map(Number);
            const start = new Date(`${fecha}T00:00:00`);
            start.setHours(hh, mm, 0, 0);
            const end = new Date(start.getTime() + duracionMin * 60_000);
            inicioIso = start.toISOString();
            finIso = end.toISOString();

            // Si se especificó mecánico o box desde el motor de disponibilidad, verificar solapamiento de rango
            if (mecanicoId || boxId) {
                const turnosDelDia = await Turno.find({ fecha, sucursalId: sucId, activo: true }).lean();
                if (!resourceFree(turnosDelDia, mecId, bxId, start, end)) {
                    return res.status(409).json({
                        mensaje: 'El horario seleccionado dejó de estar disponible (mecánico o box ocupado). Elegí otro horario.'
                    });
                }
            }
        }

        const codigo = await siguienteCodigoTurno();

        const nuevoTurno = await Turno.create({
            codigo,
            clienteId,
            vehiculoId,
            fecha,
            hora,
            servicio: nombreServicio,
            servicioId: idServicio,
            sucursalId: sucId,
            mecanicoId: mecId,
            boxId: bxId,
            duracionMin,
            inicio: inicioIso,
            fin: finIso,
            estado: 'confirmado',
            tipoPago: modalidadPago,
            packId: packValido ? packValido._id : null,
            montoPagado,
            seniaPerdida: 0
        });

        if (packValido) {
            await sincronizarPacksDB();
        }

        await registrarAuditoria(
            req.usuario?.nombre || req.usuario?.username || `${clienteExiste.nombre} ${clienteExiste.apellido}`,
            'reserva',
            `Reserva ${codigo} confirmada (${nombreServicio} · ${fecha} ${hora})`
        );

        // Poblar datos para emitir al WebSocket con información legible
        const turnoPoblado = await Turno.findById(nuevoTurno._id)
            .populate('clienteId', 'nombre apellido')
            .populate('vehiculoId', 'patente marca modelo');

        // Notificar en tiempo real a todos los clientes conectados
        if (req.io) {
            req.io.emit('turno:creado', {
                mensaje: 'Se ha agendado un nuevo turno',
                turno: turnoPoblado
            });
        }

        res.status(201).json({
            mensaje: 'Turno creado con éxito',
            codigo,
            turno: nuevoTurno
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                mensaje: 'Ya existe un turno activo en esa fecha y hora. Elegí otro horario.'
            });
        }
        next(error);
    }
};

// ACTUALIZAR TURNO
export const actualizarTurno = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ _id: req.params.id, activo: true });
        if (!turno) {
            return res.status(404).json({ mensaje: 'Turno no encontrado para actualizar' });
        }

        // Lista blanca: campos como 'activo' no se pueden modificar desde el body
        const camposPermitidos = [
            'clienteId',
            'vehiculoId',
            'fecha',
            'hora',
            'servicio',
            'servicioId',
            'sucursalId',
            'mecanicoId',
            'boxId',
            'estado',
            'tipoPago',
            'packId'
        ];
        for (const campo of camposPermitidos) {
            if (req.body[campo] !== undefined) {
                turno[campo] = req.body[campo] === '' && campo === 'packId' ? null : req.body[campo];
            }
        }

        if (req.body.servicioId && !req.body.servicio) {
            const srv = obtenerServicio(req.body.servicioId);
            if (srv) {
                turno.servicio = srv.name;
                turno.duracionMin = srv.durationMin;
            }
        }

        // Se valida sobre los valores finales, aunque llegue solo uno de los dos IDs
        const [cliente, vehiculo] = await Promise.all([
            Cliente.findOne({ _id: turno.clienteId, activo: true }),
            Vehiculo.findOne({ _id: turno.vehiculoId, activo: true })
        ]);
        if (!cliente || !vehiculo) {
            return res.status(400).json({ mensaje: 'El cliente o el vehículo no existe o está inactivo' });
        }
        if (vehiculo.clienteId.toString() !== turno.clienteId.toString()) {
            return res.status(400).json({
                mensaje: 'El vehículo seleccionado no pertenece al cliente indicado'
            });
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(String(turno.fecha || '')) && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(turno.hora || '').trim())) {
            const [hh, mm] = String(turno.hora).trim().split(':').map(Number);
            const start = new Date(`${turno.fecha}T00:00:00`);
            start.setHours(hh, mm, 0, 0);
            const end = new Date(start.getTime() + (turno.duracionMin || 60) * 60_000);
            turno.inicio = start.toISOString();
            turno.fin = end.toISOString();
        }

        await turno.save(); // ejecuta las validaciones del esquema
        await sincronizarPacksDB();

        res.json({ mensaje: 'Turno actualizado con éxito', turno });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                mensaje: 'Ya existe un turno activo en esa fecha y hora. Elegí otro horario.'
            });
        }
        next(error);
    }
};

// CAMBIAR ESTADO OPERATIVO DEL TURNO (CHECK-IN, NO-SHOW, INICIAR, COMPLETAR)
export const cambiarEstadoTurno = async (req, res, next) => {
    try {
        const { estado } = req.body;
        const estadosValidos = ['pendiente', 'confirmado', 'en_atencion', 'completado', 'no_show', 'cancelado', 'cancelacion_tardia'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ mensaje: 'Estado de turno no válido' });
        }

        const turno = await Turno.findById(req.params.id);
        if (!turno) {
            return res.status(404).json({ mensaje: 'Turno no encontrado' });
        }

        turno.estado = estado;
        if (estado === 'no_show' && turno.tipoPago === 'individual' && !turno.seniaPerdida) {
            const srv = obtenerServicio(turno.servicioId || turno.servicio);
            turno.seniaPerdida = srv ? srv.deposit : (turno.montoPagado || 8000);
        }
        if (['cancelado', 'cancelacion_tardia'].includes(estado)) {
            turno.activo = false;
        }

        await turno.save();
        await sincronizarPacksDB();

        const codigo = turno.codigo || turno._id.toString().slice(-6);
        await registrarAuditoria(
            req.usuario?.nombre || req.usuario?.username || 'operador',
            'estado',
            `${codigo} → ${appointmentLabel(estado)}`
        );

        if (req.io) {
            req.io.emit('turno:estado', {
                id: turno._id,
                estado,
                mensaje: `Turno ${codigo}: ${appointmentLabel(estado)}`
            });
        }

        res.json({
            mensaje: `Estado actualizado a ${appointmentLabel(estado)}`,
            turno
        });
    } catch (error) {
        next(error);
    }
};

// CANCELAR TURNO (BAJA LÓGICA + REGLA DE 24 HORAS DE TURNOFLEX)
export const cancelarTurnoPorId = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ _id: req.params.id, activo: true });
        if (!turno) {
            return res.status(404).json({ mensaje: 'Turno no encontrado' });
        }

        const tardia = isLateCancel(turno);
        const srv = obtenerServicio(turno.servicioId || turno.servicio);
        const senia = srv ? srv.deposit : 8000;

        turno.activo = false;
        turno.estado = tardia ? 'cancelacion_tardia' : 'cancelado';
        turno.seniaPerdida = tardia && turno.tipoPago === 'individual' ? senia : 0;

        await turno.save();
        await sincronizarPacksDB();

        const codigo = turno.codigo || turno._id.toString().slice(-6);
        await registrarAuditoria(
            req.usuario?.nombre || req.usuario?.username || 'sistema',
            'cancelacion',
            `${codigo} · ${tardia ? 'tardía' : 'sin penalización'} · ${appointmentLabel(turno.estado)}`
        );

        const mensajeDetalle = !tardia
            ? (turno.tipoPago === 'pack'
                ? 'Turno cancelado correctamente. El crédito volvió a tu pack porque faltaban más de 24 horas.'
                : 'Turno cancelado correctamente sin penalización. El horario ya está libre para otro cliente.')
            : (turno.tipoPago === 'pack'
                ? 'Turno cancelado (cancelación tardía: se consume 1 crédito del pack, según la política de AutoBox).'
                : `Turno cancelado (cancelación tardía: se pierde la seña de $${senia.toLocaleString('es-AR')} ARS).`);

        // Notificar en tiempo real la cancelación
        if (req.io) {
            req.io.emit('turno:cancelado', {
                id: req.params.id,
                mensaje: mensajeDetalle
            });
        }

        res.json({
            mensaje: mensajeDetalle,
            estado: turno.estado,
            tardia,
            seniaPerdida: turno.seniaPerdida
        });
    } catch (error) {
        next(error);
    }
};
