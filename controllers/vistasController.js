import path from 'path';
import fs from 'fs';
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

// ==========================================
// CENTRO DE AYUDA Y PREGUNTAS FRECUENTES
// ==========================================
export const renderAyuda = async (req, res, next) => {
    try {
        const faqs = [
            {
                id: 'faq-disponibilidad',
                categoria: 'turnos',
                categoriaLabel: 'Turnos y Agenda',
                pregunta: '¿Cómo asigna el sistema los horarios, mecánicos y boxes disponibles al reservar un turno?',
                respuesta: 'El motor de disponibilidad de TurnoFlex · AutoBox evalúa bloques cada 30 minutos para la sucursal, servicio y fecha elegidos. Solo habilita un turno si se cumplen 4 condiciones simultáneas: (1) el mecánico pertenece a esa sucursal y tiene la especialidad técnica del servicio, (2) el servicio completo (45 a 120 min) entra dentro del horario laboral del mecánico, (3) si el servicio requiere elevador hidráulico se asigna únicamente un box con elevador, y (4) ni el mecánico ni el box tienen otro turno superpuesto en estado Pendiente, Confirmado o En atención.'
            },
            {
                id: 'faq-cancelacion-tardia',
                categoria: 'turnos',
                categoriaLabel: 'Turnos y Agenda',
                pregunta: '¿Qué pasa si cancelo un turno con menos de 24 horas de anticipación (Cancelación Tardía)?',
                respuesta: 'El sistema aplica automáticamente la Regla de Ventana de 24 Horas. Si el turno se cancela con más de 24 horas de anticipación respecto a su inicio, no hay penalización y si se utilizó un crédito de Pack Flota 10 el crédito se reintegra al pack. Si se cancela con menos de 24 horas de anticipación (o el cliente no se presenta al turno), el estado pasa a "Cancelación tardía" (o "No-show"), la seña queda retenida como perdida o el crédito del Pack Flota 10 queda consumido sin devolución.'
            },
            {
                id: 'faq-modalidades-pago',
                categoria: 'turnos',
                categoriaLabel: 'Turnos y Agenda',
                pregunta: '¿Qué modalidades de pago existen al reservar un turno?',
                respuesta: 'Al crear un turno podés elegir entre tres modalidades: (1) Seña mínima del servicio (deja el turno confirmado abonando solo el anticipo), (2) Pago total (abona el 100% del arancel del servicio), o (3) Crédito de Pack Flota 10 (descuenta 1 crédito de un pack activo del cliente, disponible únicamente para servicios elegibles: Cambio de aceite y filtros, Revisión general, Alineación y balanceo, y Mantenimiento preventivo).'
            },
            {
                id: 'faq-estados-turno',
                categoria: 'turnos',
                categoriaLabel: 'Turnos y Agenda',
                pregunta: '¿Cuáles son los estados por los que pasa un turno desde la reserva hasta su cierre?',
                respuesta: 'Un turno puede encontrarse en: Pendiente (reservado a la espera de confirmación), Confirmado (garantizado con seña, pago total o pack), En atención (cuando el cliente hizo Check-In en recepción y el vehículo ingresó al box), Completado (trabajo finalizado por el mecánico; genera comisión del 35%), Cancelado (anulado con más de 24 h), Cancelación tardía (anulado con menos de 24 h; retiene seña/crédito) o No-show / Ausente (el cliente no asistió).'
            },
            {
                id: 'faq-elevador',
                categoria: 'turnos',
                categoriaLabel: 'Turnos y Agenda',
                pregunta: '¿Por qué ciertos servicios no permiten elegir algunos boxes de la sucursal?',
                respuesta: 'Servicios como Cambio de aceite, Revisión general, Frenos, Suspensión y Mantenimiento preventivo requieren obligatoriamente un box con elevador hidráulico (por ejemplo, Box 1 · Elevador). Los boxes rápidos o de diagnóstico sin elevador (como Box 2 en Norte u Oeste) solo se habilitan para Alineación y balanceo, Baterías o Diagnóstico automotor.'
            },
            {
                id: 'faq-pack-que-es',
                categoria: 'packs',
                categoriaLabel: 'Packs Flota 10',
                pregunta: '¿Qué es el Pack Flota 10, cuánto dura y qué servicios incluye?',
                respuesta: 'El Pack Flota 10 es un paquete prepago de 10 servicios de mantenimiento pensado para flotas corporativas y clientes frecuentes. Tiene un valor promocional de $ 380.000, una vigencia de 365 días (1 año) desde su compra y permite canjear créditos en cualquiera de las tres sucursales para: Cambio de aceite y filtros, Revisión general, Alineación y balanceo, y Mantenimiento preventivo.'
            },
            {
                id: 'faq-pack-congelamiento-80',
                categoria: 'packs',
                categoriaLabel: 'Packs Flota 10',
                pregunta: '¿Cómo puedo congelar temporalmente un Pack Flota 10 y por qué a veces se bloquea (Regla del 80%)?',
                respuesta: 'Desde la sección "Packs y créditos" podés solicitar pausar la vigencia de un pack activo indicando la cantidad de días solicitados (entre 7 y 60 días) y el motivo. Por regla de negocio, solo se permite solicitar el congelamiento si el pack tiene menos del 80% de uso (es decir, hasta 7 créditos utilizados como máximo). Si ya se consumieron 8 o más créditos, el sistema bloquea automáticamente el congelamiento.'
            },
            {
                id: 'faq-pack-aprobacion',
                categoria: 'packs',
                categoriaLabel: 'Packs Flota 10',
                pregunta: '¿Qué ocurre con la fecha de vencimiento del Pack cuando Coordinación aprueba un congelamiento?',
                respuesta: 'Al enviarse la solicitud de congelamiento, queda en estado "Pendiente" en la bandeja de Coordinación. Cuando el Coordinador o Gerencia la aprueba, el sistema extiende automáticamente la fecha de vencimiento original del pack sumándole la cantidad exacta de días aprobados y registra la operación en la bitácora de Auditoría.'
            },
            {
                id: 'faq-checkin-recepcion',
                categoria: 'operacion',
                categoriaLabel: 'Recepción y Taller',
                pregunta: '¿Cómo realizo el Check-In de un vehículo cuando el cliente llega a la sucursal?',
                respuesta: 'Ingresá al módulo "Recepción" (/recepcion), filtrá por tu sucursal o fecha, localizá el turno del cliente y presioná el botón "Check-in → En atención". El estado cambiará inmediatamente a "En atención" y la orden de trabajo aparecerá destacada en la pantalla de Taller del mecánico asignado.'
            },
            {
                id: 'faq-noshow',
                categoria: 'operacion',
                categoriaLabel: 'Recepción y Taller',
                pregunta: '¿Qué debo hacer en Recepción si el cliente no se presenta al turno (No-show)?',
                respuesta: 'En la bandeja de "Recepción" (/recepcion) o en el detalle del turno, presioná el botón "No-show". El turno quedará registrado como ausente, liberará el box para consultas operativas, retendrá automáticamente la seña o el crédito del Pack Flota 10 utilizado, y sumará el evento a la métrica de ausentismo del Dashboard.'
            },
            {
                id: 'faq-taller-mecanico',
                categoria: 'operacion',
                categoriaLabel: 'Recepción y Taller',
                pregunta: 'Soy mecánico: ¿cómo inicio un trabajo, lo finalizo o reporto un desvío / imprevisto técnico?',
                respuesta: 'Al iniciar sesión con perfil Mecánico ingresás directamente a "Mis trabajos" (/taller), donde ves tus turnos asignados. Podés presionar "Iniciar atención" cuando el vehículo entra al box y "Completar trabajo" al terminar la reparación. Si encontrás una falla adicional, un bulón gripado o necesitás extender el tiempo en box, completá el formulario "Solicitar excepción al coordinador" al pie del turno indicando los minutos extra y el motivo técnico.'
            },
            {
                id: 'faq-coordinacion-bandejas',
                categoria: 'gestion',
                categoriaLabel: 'Coordinación y Gestión',
                pregunta: '¿Dónde se aprueban o rechazan los congelamientos de Packs y las excepciones de Taller?',
                respuesta: 'En el módulo "Coordinación" (/coordinacion), disponible para Coordinadores, Gerencia y Administradores. Allí encontrarás dos bandejas independientes: una para aprobar/rechazar solicitudes de congelamiento de Packs Flota 10 y otra para aprobar/rechazar desvíos horarios reportados por los mecánicos desde el taller (que al aprobarse extienden automáticamente la duración y hora de fin del turno).'
            },
            {
                id: 'faq-liquidaciones',
                categoria: 'gestion',
                categoriaLabel: 'Coordinación y Gestión',
                pregunta: '¿Cómo se calculan las liquidaciones y comisiones de los mecánicos?',
                respuesta: 'En la sección "Liquidaciones" (/liquidaciones), el sistema filtra todos los turnos en estado "Completado" dentro del rango de fechas seleccionado y calcula automáticamente una comisión del 35% sobre el valor de lista de cada servicio ejecutado por cada profesional, mostrando el desglose orden por orden y el total neto a abonar.'
            },
            {
                id: 'faq-alertas-reset',
                categoria: 'gestion',
                categoriaLabel: 'Coordinación y Gestión',
                pregunta: '¿Cómo funcionan el barrido de alertas automáticas y la restauración de la Semilla Demo?',
                respuesta: 'Dentro de "Auditoría" (/auditoria), el botón "Ejecutar barrido de alertas" analiza todos los Packs Flota 10 activos y emite alertas cuando un pack vence en 30 días o menos, o cuando le quedan 2 o menos créditos disponibles. Por su parte, el botón "Restaurar semilla demo" reinicia los datos operativos de demostración (clientes, vehículos, turnos, packs y auditoría) a su estado original sin borrar las cuentas de usuario.'
            },
            {
                id: 'faq-roles-permisos',
                categoria: 'acceso',
                categoriaLabel: 'Roles y Accesos',
                pregunta: '¿Por qué cada usuario ve distintas opciones en el menú y entra a una pantalla diferente?',
                respuesta: 'TurnoFlex · AutoBox aplica Control de Acceso Basado en Roles (RBAC). Al iniciar sesión, el sistema redirige a cada perfil a su puesto de trabajo principal: Mecánico va a Taller (/taller), Recepción va a Recepción (/recepcion), Coordinador va a Coordinación (/coordinacion) y Gerencia va al Dashboard (/dashboard). Además, la recaudación monetaria en el Dashboard está oculta para Recepción y Taller.'
            },
            {
                id: 'faq-asesor-ia',
                categoria: 'ia',
                categoriaLabel: 'Asesor IA',
                pregunta: '¿Cómo utilizo el Asesor Técnico Inteligente con IA?',
                respuesta: 'En cualquier pantalla del sistema (estando autenticado) verás el botón circular naranja flotante en la esquina inferior derecha. Al hacer clic se abre el chat en tiempo real conectado vía WebSockets (Socket.IO) con Google Gemini, donde podés consultar síntomas mecánicos, diagnósticos preliminares o recomendaciones de servicio.'
            }
        ];

        const guiasPorRol = {
            admin: {
                titulo: 'Perfil Administrador · Acceso Total',
                descripcion: 'Tenés control completo sobre todos los módulos operativos, gerenciales y la administración de cuentas de usuario.',
                acciones: [
                    { texto: 'Gestionar Usuarios', url: '/usuarios' },
                    { texto: 'Ver Dashboard KPIs', url: '/dashboard' },
                    { texto: 'Mesa de Coordinación', url: '/coordinacion' },
                    { texto: 'Auditoría y Alertas', url: '/auditoria' }
                ]
            },
            gerencia: {
                titulo: 'Perfil Gerencia General · Supervisión y KPIs',
                descripcion: 'Tu vista está orientada al seguimiento de indicadores clave, recaudación, liquidaciones, auditoría y aprobación de solicitudes en coordinación.',
                acciones: [
                    { texto: 'Ir al Dashboard', url: '/dashboard' },
                    { texto: 'Ver Liquidaciones', url: '/liquidaciones' },
                    { texto: 'Coordinación', url: '/coordinacion' },
                    { texto: 'Auditoría', url: '/auditoria' }
                ]
            },
            coordinador: {
                titulo: 'Perfil Jefe de Taller / Coordinador',
                descripcion: 'Supervisás la operación de la sucursal, aprobás o rechazás congelamientos de packs y excepciones de mecánicos, y controlás liquidaciones.',
                acciones: [
                    { texto: 'Mesa de Coordinación', url: '/coordinacion' },
                    { texto: 'Supervisar Taller', url: '/taller' },
                    { texto: 'Recepción', url: '/recepcion' },
                    { texto: 'Liquidaciones', url: '/liquidaciones' }
                ]
            },
            recepcion: {
                titulo: 'Perfil Recepción de Sucursal',
                descripcion: 'Gestionás la atención en mostrador: alta de clientes y vehículos, reserva de turnos, Check-In de ingreso a box y control de ausencias (No-show).',
                acciones: [
                    { texto: 'Bandeja de Recepción', url: '/recepcion' },
                    { texto: 'Reservar Nuevo Turno', url: '/turnos/nuevo' },
                    { texto: 'Clientes', url: '/clientes' },
                    { texto: 'Indicadores Operativos', url: '/dashboard' }
                ]
            },
            mecanico: {
                titulo: 'Perfil Técnico Mecánico de Taller',
                descripcion: 'Consultás tu agenda de órdenes asignadas en box, iniciás y completás servicios, y reportás desvíos o excepciones técnicas al coordinador.',
                acciones: [
                    { texto: 'Ir a Mis Trabajos en Taller', url: '/taller' }
                ]
            },
            cliente: {
                titulo: 'Perfil Cliente / Flota',
                descripcion: 'Podés registrar tus vehículos, reservar o cancelar turnos eligiendo sucursal y horario disponible, y administrar tus Packs Flota 10.',
                acciones: [
                    { texto: 'Reservar Turno', url: '/turnos/nuevo' },
                    { texto: 'Mis Turnos', url: '/turnos' },
                    { texto: 'Mis Packs y Créditos', url: '/packs' },
                    { texto: 'Mis Vehículos', url: '/vehiculos' }
                ]
            },
            operador: {
                titulo: 'Perfil Operador AutoBox',
                descripcion: 'Contás con acceso operativo a la gestión de clientes, vehículos, agenda de turnos, recepción en mostrador y seguimiento de taller.',
                acciones: [
                    { texto: 'Agenda de Turnos', url: '/turnos' },
                    { texto: 'Recepción', url: '/recepcion' },
                    { texto: 'Taller', url: '/taller' },
                    { texto: 'Clientes', url: '/clientes' }
                ]
            }
        };

        const rolActual = req.usuario?.rol || 'operador';
        const guiaRol = guiasPorRol[rolActual] || guiasPorRol.operador;

        res.render('ayuda', {
            ...helpersVista,
            faqs,
            guiaRol
        });
    } catch (error) {
        next(error);
    }
};

export const descargarManualWord = (req, res, next) => {
    try {
        const rutaManual = path.resolve(process.cwd(), 'Manual_de_Usuario_TurnoFlex_AutoBox.docx');
        if (!fs.existsSync(rutaManual)) {
            return res.status(404).render('404', {
                titulo: 'Manual no encontrado',
                mensaje: 'El archivo Manual_de_Usuario_TurnoFlex_AutoBox.docx no se encuentra en el directorio del proyecto.'
            });
        }
        return res.download(rutaManual, 'Manual_de_Usuario_TurnoFlex_AutoBox.docx');
    } catch (error) {
        next(error);
    }
};
