import Cliente from '../models/Cliente.js';
import Vehiculo from '../models/Vehiculo.js';
import Turno from '../models/Turno.js';
import Pack from '../models/Pack.js';
import Congelamiento from '../models/Congelamiento.js';
import Excepcion from '../models/Excepcion.js';
import Auditoria from '../models/Auditoria.js';
import Alerta from '../models/Alerta.js';

import { agregarCliente, modificarClientePorId } from './clientesController.js';
import { agregarVehiculo, modificarVehiculoPorId } from './vehiculosController.js';
import { crearTurno, actualizarTurno, cambiarEstadoTurno } from './turnosController.js';
import {
    crearPack,
    solicitarCongelamiento,
    resolverCongelamiento,
    solicitarExcepcion,
    resolverExcepcion,
    generarAlertasPendientes,
    resetearDemoTurnoFlex
} from './turnoflexController.js';
import {
    SUCURSALES,
    SERVICIOS,
    MECANICOS,
    BOXES,
    obtenerSucursal,
    obtenerServicio,
    obtenerMecanico,
    obtenerBox,
    appointmentLabel,
    formatMoney,
    formatDate,
    formatDateTime,
    isLateCancel,
    sincronizarPacksDB,
    mechanicSettlements,
    calcularDashboard
} from '../services/turnoflexEngine.js';

const helpersVista = {
    sucursalesCatalogo: SUCURSALES,
    serviciosCatalogo: SERVICIOS,
    mecanicosCatalogo: MECANICOS,
    boxesCatalogo: BOXES,
    obtenerSucursal,
    obtenerServicio,
    obtenerMecanico,
    obtenerBox,
    appointmentLabel,
    formatMoney,
    formatDate,
    formatDateTime,
    isLateCancel
};

// Adaptador para reutilizar controladores desde formularios
const ejecutarAccion = async (controlador, req, res, destino) => {
    let codigoEstado = 200;
    let resultado;
    const respuesta = {
        status(codigo) {
            codigoEstado = codigo;
            return this;
        },
        json(datos) {
            resultado = datos;
            return this;
        },
        send(datos) {
            resultado = datos;
            return this;
        }
    };
    try {
        await controlador(req, respuesta, (err) => {
            throw err;
        });
        if (codigoEstado >= 400) {
            return res.status(codigoEstado).render('404', {
                titulo: 'Error en la operación',
                mensaje: resultado?.mensaje || resultado?.error || 'No se pudo completar la operación.'
            });
        }
        return res.redirect(destino);
    } catch (error) {
        return res.status(error.status || 500).render('404', {
            titulo: 'Error en la solicitud',
            mensaje: error.message || 'Ocurrió un error al procesar el formulario'
        });
    }
};

// Inicio
export const renderInicio = async (req, res, next) => {
    try {
        if (req.usuario?.rol === 'mecanico') {
            return res.redirect('/taller');
        }
        const [totalClientes, totalVehiculos, totalTurnos, totalPacks] = await Promise.all([
            Cliente.countDocuments({ activo: true }),
            Vehiculo.countDocuments({ activo: true }),
            Turno.countDocuments({ activo: true }),
            Pack.countDocuments({ activo: true, estado: 'activo' })
        ]);
        res.render('index', {
            ...helpersVista,
            totalClientes,
            totalVehiculos,
            totalTurnos,
            totalPacks
        });
    } catch (error) {
        next(error);
    }
};

// Vistas Clientes
export const renderClientes = async (req, res, next) => {
    try {
        const clientes = await Cliente.find({ activo: true }).sort({ createdAt: -1 }).lean();
        res.render('clientes', { ...helpersVista, clientes });
    } catch (error) {
        next(error);
    }
};

export const renderNuevoCliente = (req, res) => {
    res.render('nuevoCliente', { ...helpersVista });
};

export const renderClienteDetalle = async (req, res, next) => {
    try {
        const cliente = await Cliente.findOne({ _id: req.params.id, activo: true }).lean();
        if (!cliente) return res.status(404).render('404', { titulo: 'No encontrado', mensaje: 'Cliente no encontrado' });

        await sincronizarPacksDB();
        const [vehiculos, packs, turnos] = await Promise.all([
            Vehiculo.find({ clienteId: cliente._id, activo: true }).lean(),
            Pack.find({ clienteId: cliente._id, activo: true }).lean(),
            Turno.find({ clienteId: cliente._id }).populate('vehiculoId').sort({ fecha: -1, hora: -1 }).lean()
        ]);

        res.render('clienteDetalle', { ...helpersVista, cliente, vehiculos, packs, turnos });
    } catch (error) {
        next(error);
    }
};

export const renderEditarCliente = async (req, res, next) => {
    try {
        const cliente = await Cliente.findOne({ _id: req.params.id, activo: true }).lean();
        if (!cliente) return res.status(404).render('404', { titulo: 'No encontrado', mensaje: 'Cliente no encontrado' });

        res.render('editarCliente', { ...helpersVista, cliente });
    } catch (error) {
        next(error);
    }
};

export const procesarNuevoCliente = async (req, res) => {
    await ejecutarAccion(agregarCliente, req, res, '/clientes');
};

export const procesarModificarCliente = async (req, res) => {
    await ejecutarAccion(modificarClientePorId, req, res, '/clientes');
};

// Vistas Vehículos
export const renderVehiculos = async (req, res, next) => {
    try {
        const vehiculos = await Vehiculo.find({ activo: true }).populate('clienteId').sort({ createdAt: -1 }).lean();
        res.render('vehiculos', { ...helpersVista, vehiculos });
    } catch (error) {
        next(error);
    }
};

export const renderNuevoVehiculo = async (req, res, next) => {
    try {
        const clientes = await Cliente.find({ activo: true }).lean();
        res.render('nuevoVehiculo', { ...helpersVista, clientes });
    } catch (error) {
        next(error);
    }
};

export const renderVehiculoDetalle = async (req, res, next) => {
    try {
        const vehiculo = await Vehiculo.findOne({ _id: req.params.id, activo: true }).populate('clienteId').lean();
        if (!vehiculo) return res.status(404).render('404', { titulo: 'No encontrado', mensaje: 'Vehículo no encontrado' });
        const turnosVehiculo = await Turno.find({ vehiculoId: vehiculo._id }).sort({ fecha: -1, hora: -1 }).lean();
        res.render('vehiculoDetalle', { ...helpersVista, vehiculo, turnosVehiculo });
    } catch (error) {
        next(error);
    }
};

export const renderEditarVehiculo = async (req, res, next) => {
    try {
        const [vehiculo, clientes] = await Promise.all([
            Vehiculo.findOne({ _id: req.params.id, activo: true }).populate('clienteId').lean(),
            Cliente.find({ activo: true }).lean()
        ]);
        if (!vehiculo) return res.status(404).render('404', { titulo: 'No encontrado', mensaje: 'Vehículo no encontrado' });
        res.render('editarVehiculo', { ...helpersVista, vehiculo, clientes });
    } catch (error) {
        next(error);
    }
};

export const procesarNuevoVehiculo = async (req, res) => {
    await ejecutarAccion(agregarVehiculo, req, res, '/vehiculos');
};

export const procesarModificarVehiculo = async (req, res) => {
    await ejecutarAccion(modificarVehiculoPorId, req, res, `/vehiculos/${req.params.id}`);
};

// Vistas Turnos
export const renderTurnos = async (req, res, next) => {
    try {
        const mostrarTodos = req.query.todos === '1';
        const filtro = mostrarTodos ? {} : { activo: true };
        const turnos = await Turno.find(filtro)
            .populate('clienteId')
            .populate('vehiculoId')
            .populate('packId')
            .sort({ fecha: -1, hora: -1 })
            .lean();
        res.render('turnos', { ...helpersVista, turnos, mostrarTodos });
    } catch (error) {
        next(error);
    }
};

export const renderNuevoTurno = async (req, res, next) => {
    try {
        await sincronizarPacksDB();
        const [clientes, vehiculos, packs] = await Promise.all([
            Cliente.find({ activo: true }).lean(),
            Vehiculo.find({ activo: true }).lean(),
            Pack.find({ activo: true, estado: 'activo' }).lean()
        ]);
        res.render('nuevoTurno', { ...helpersVista, clientes, vehiculos, packs });
    } catch (error) {
        next(error);
    }
};

export const renderTurnoDetalle = async (req, res, next) => {
    try {
        const turno = await Turno.findById(req.params.id)
            .populate('clienteId')
            .populate('vehiculoId')
            .populate('packId')
            .lean();
        if (!turno) return res.status(404).render('404', { titulo: 'No encontrado', mensaje: 'Turno no encontrado' });
        res.render('turnoDetalle', { ...helpersVista, turno });
    } catch (error) {
        next(error);
    }
};

export const renderEditarTurno = async (req, res, next) => {
    try {
        await sincronizarPacksDB();
        const [turno, clientes, vehiculos, packs] = await Promise.all([
            Turno.findOne({ _id: req.params.id, activo: true }).lean(),
            Cliente.find({ activo: true }).lean(),
            Vehiculo.find({ activo: true }).lean(),
            Pack.find({ activo: true }).lean()
        ]);
        if (!turno) return res.status(404).render('404', { titulo: 'No encontrado', mensaje: 'Turno no encontrado' });
        res.render('editarTurno', { ...helpersVista, turno, clientes, vehiculos, packs });
    } catch (error) {
        next(error);
    }
};

export const procesarNuevoTurno = async (req, res) => {
    await ejecutarAccion(crearTurno, req, res, '/turnos');
};

export const procesarModificarTurno = async (req, res) => {
    await ejecutarAccion(actualizarTurno, req, res, `/turnos/${req.params.id}`);
};

export const procesarEstadoTurno = async (req, res) => {
    const destino = req.body.redirectTo || req.get('Referer') || '/turnos';
    await ejecutarAccion(cambiarEstadoTurno, req, res, destino);
};

// ==========================================
// VISTAS TURNOFLEX: PACKS Y CRÉDITOS
// ==========================================
export const renderPacks = async (req, res, next) => {
    try {
        await sincronizarPacksDB();
        const [packs, clientes, congelamientos] = await Promise.all([
            Pack.find({ activo: true }).populate('clienteId').sort({ createdAt: -1 }).lean(),
            Cliente.find({ activo: true }).sort({ nombre: 1 }).lean(),
            Congelamiento.find()
                .populate({ path: 'packId', populate: { path: 'clienteId' } })
                .sort({ createdAt: -1 })
                .lean()
        ]);
        res.render('packs', {
            ...helpersVista,
            packs,
            clientes,
            congelamientos,
            exito: req.query.exito
        });
    } catch (error) {
        next(error);
    }
};

export const procesarNuevoPack = async (req, res) => {
    await ejecutarAccion(crearPack, req, res, '/packs?exito=pack_creado');
};

export const procesarCongelarPack = async (req, res) => {
    await ejecutarAccion(solicitarCongelamiento, req, res, '/packs?exito=congelamiento_solicitado');
};

// ==========================================
// VISTAS TURNOFLEX: RECEPCIÓN
// ==========================================
export const renderRecepcion = async (req, res, next) => {
    try {
        const sucursalSeleccionada = req.query.sucursal || 'todas';
        const filtro = sucursalSeleccionada === 'todas' ? {} : { sucursalId: sucursalSeleccionada };
        const turnos = await Turno.find(filtro)
            .populate('clienteId')
            .populate('vehiculoId')
            .populate('packId')
            .sort({ fecha: -1, hora: 1 })
            .lean();

        res.render('recepcion', {
            ...helpersVista,
            turnos,
            sucursalSeleccionada
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// VISTAS TURNOFLEX: TALLER
// ==========================================
export const renderTaller = async (req, res, next) => {
    try {
        const mecanicoSeleccionado = req.query.mecanico || 'todos';
        const filtro = mecanicoSeleccionado === 'todos' ? {} : { mecanicoId: mecanicoSeleccionado };
        const [trabajos, excepciones] = await Promise.all([
            Turno.find(filtro)
                .populate('clienteId')
                .populate('vehiculoId')
                .sort({ fecha: -1, hora: 1 })
                .lean(),
            Excepcion.find().sort({ createdAt: -1 }).limit(10).lean()
        ]);

        res.render('taller', {
            ...helpersVista,
            trabajos,
            excepciones,
            mecanicoSeleccionado,
            exito: req.query.exito
        });
    } catch (error) {
        next(error);
    }
};

export const procesarSolicitarExcepcion = async (req, res) => {
    await ejecutarAccion(solicitarExcepcion, req, res, '/taller?exito=excepcion_enviada');
};

// ==========================================
// VISTAS TURNOFLEX: COORDINACIÓN
// ==========================================
export const renderCoordinacion = async (req, res, next) => {
    try {
        await sincronizarPacksDB();
        const [congelamientos, excepciones] = await Promise.all([
            Congelamiento.find()
                .populate({ path: 'packId', populate: { path: 'clienteId' } })
                .sort({ createdAt: -1 })
                .lean(),
            Excepcion.find().sort({ createdAt: -1 }).lean()
        ]);

        res.render('coordinacion', {
            ...helpersVista,
            congelamientos,
            excepciones,
            exito: req.query.exito
        });
    } catch (error) {
        next(error);
    }
};

export const procesarResolverCongelamiento = async (req, res) => {
    await ejecutarAccion(resolverCongelamiento, req, res, '/coordinacion?exito=congelamiento_resuelto');
};

export const procesarResolverExcepcion = async (req, res) => {
    await ejecutarAccion(resolverExcepcion, req, res, '/coordinacion?exito=excepcion_resuelta');
};

// ==========================================
// VISTAS TURNOFLEX: LIQUIDACIONES QUINCENALES
// ==========================================
export const renderLiquidaciones = async (req, res, next) => {
    try {
        const desde = req.query.desde || '2026-08-01';
        const hasta = req.query.hasta || '2026-09-30';
        const turnos = await Turno.find({ estado: 'completado' })
            .populate('clienteId')
            .populate('vehiculoId')
            .sort({ fecha: 1, hora: 1 })
            .lean();

        const liquidaciones = MECANICOS.map((m) => mechanicSettlements(turnos, m, desde, hasta));
        const totalGeneral = liquidaciones.reduce((acc, l) => acc + l.total, 0);

        res.render('liquidaciones', {
            ...helpersVista,
            desde,
            hasta,
            liquidaciones,
            totalGeneral
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// VISTAS TURNOFLEX: DASHBOARD DE GESTIÓN
// ==========================================
export const renderDashboard = async (req, res, next) => {
    try {
        await sincronizarPacksDB();
        const [turnos, packs] = await Promise.all([
            Turno.find().lean(),
            Pack.find({ activo: true }).populate('clienteId').lean()
        ]);

        const dashboard = calcularDashboard(turnos, packs, req.query);
        const canSeeMoney = req.usuario?.rol !== 'recepcion';

        res.render('dashboard', {
            ...helpersVista,
            dashboard,
            packs,
            canSeeMoney
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// VISTAS TURNOFLEX: AUDITORÍA Y ALERTAS
// ==========================================
export const renderAuditoria = async (req, res, next) => {
    try {
        const [auditoria, alertas] = await Promise.all([
            Auditoria.find().sort({ fecha: -1, createdAt: -1 }).limit(100).lean(),
            Alerta.find().sort({ fecha: -1, createdAt: -1 }).limit(100).lean()
        ]);

        res.render('auditoria', {
            ...helpersVista,
            auditoria,
            alertas,
            exito: req.query.exito
        });
    } catch (error) {
        next(error);
    }
};

export const procesarGenerarAlertas = async (req, res) => {
    await ejecutarAccion(generarAlertasPendientes, req, res, '/auditoria?exito=alertas_generadas');
};

export const procesarResetDemo = async (req, res) => {
    await ejecutarAccion(resetearDemoTurnoFlex, req, res, '/auditoria?exito=demo_restaurada');
};
