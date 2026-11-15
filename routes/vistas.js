import express from 'express';
import * as vistasController from '../controllers/vistasController.js';
import * as authController from '../controllers/authController.js';
import { protegerRuta, requiereRol } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ==========================================
// Rutas Públicas (Autenticación con MongoDB)
// ==========================================
router.get('/login', authController.renderLogin);
router.post('/login', authController.procesarLogin);
router.get('/logout', authController.procesarLogout);

// ==========================================
// Rutas Protegidas (Requieren Login y Rol autorizado)
// ==========================================

// Inicio (si ingresa un mecánico lo redirige a /taller)
router.get('/', protegerRuta, vistasController.renderInicio);

// Clientes
router.get('/clientes', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia', 'cliente'), vistasController.renderClientes);
router.get('/clientes/nuevo', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.renderNuevoCliente);
router.get('/clientes/:id/editar', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.renderEditarCliente);
router.post('/clientes/:id/editar', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.procesarModificarCliente);
router.get('/clientes/:id', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia', 'cliente'), vistasController.renderClienteDetalle);
router.post('/clientes', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.procesarNuevoCliente);

// Vehículos
router.get('/vehiculos', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia', 'cliente'), vistasController.renderVehiculos);
router.get('/vehiculos/nuevo', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia', 'cliente'), vistasController.renderNuevoVehiculo);
router.get('/vehiculos/:id/editar', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.renderEditarVehiculo);
router.post('/vehiculos/:id/editar', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.procesarModificarVehiculo);
router.get('/vehiculos/:id', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia', 'cliente'), vistasController.renderVehiculoDetalle);
router.post('/vehiculos', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia', 'cliente'), vistasController.procesarNuevoVehiculo);

// Turnos
router.get('/turnos', requiereRol('operador', 'cliente', 'recepcion', 'coordinador', 'gerencia'), vistasController.renderTurnos);
router.get('/turnos/nuevo', requiereRol('operador', 'cliente', 'recepcion', 'coordinador', 'gerencia'), vistasController.renderNuevoTurno);
router.get('/turnos/:id/editar', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.renderEditarTurno);
router.post('/turnos/:id/editar', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.procesarModificarTurno);
router.post('/turnos/:id/estado', requiereRol('operador', 'recepcion', 'mecanico', 'coordinador', 'gerencia'), vistasController.procesarEstadoTurno);
router.get('/turnos/:id', requiereRol('operador', 'cliente', 'recepcion', 'mecanico', 'coordinador', 'gerencia'), vistasController.renderTurnoDetalle);
router.post('/turnos', requiereRol('operador', 'cliente', 'recepcion', 'coordinador', 'gerencia'), vistasController.procesarNuevoTurno);

// Packs Flota 10 y Créditos
router.get('/packs', requiereRol('cliente', 'coordinador', 'gerencia'), vistasController.renderPacks);
router.post('/packs', requiereRol('cliente', 'coordinador', 'gerencia'), vistasController.procesarNuevoPack);
router.post('/packs/:id/congelar', requiereRol('cliente', 'coordinador', 'gerencia'), vistasController.procesarCongelarPack);

// Operación Taller: Recepción, Taller, Coordinación
router.get('/recepcion', requiereRol('operador', 'recepcion', 'coordinador', 'gerencia'), vistasController.renderRecepcion);
router.get('/taller', requiereRol('operador', 'mecanico', 'coordinador'), vistasController.renderTaller);
router.post('/taller/excepcion', requiereRol('operador', 'mecanico', 'coordinador'), vistasController.procesarSolicitarExcepcion);
router.get('/coordinacion', requiereRol('coordinador', 'gerencia'), vistasController.renderCoordinacion);
router.post('/coordinacion/congelamientos/:id', requiereRol('coordinador', 'gerencia'), vistasController.procesarResolverCongelamiento);
router.post('/coordinacion/excepciones/:id', requiereRol('coordinador', 'gerencia'), vistasController.procesarResolverExcepcion);

// Gestión: Liquidaciones, Dashboard y Auditoría
router.get('/liquidaciones', requiereRol('coordinador', 'gerencia'), vistasController.renderLiquidaciones);
router.get('/dashboard', requiereRol('recepcion', 'coordinador', 'gerencia'), vistasController.renderDashboard);
router.get('/auditoria', requiereRol('coordinador', 'gerencia'), vistasController.renderAuditoria);
router.post('/auditoria/alertas', requiereRol('coordinador', 'gerencia'), vistasController.procesarGenerarAlertas);
router.post('/auditoria/reset-demo', requiereRol('coordinador', 'gerencia'), vistasController.procesarResetDemo);

// Asesor Técnico con IA
router.get('/asistente', protegerRuta, (req, res) => {
    res.render('asistente', {
        titulo: 'Asesor Técnico Inteligente'
    });
});

export default router;
