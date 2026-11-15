import express from 'express';
import * as turnoflexController from '../controllers/turnoflexController.js';
import { requiereRolApi } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Catálogos (Sucursales, Servicios, Mecánicos, Boxes)
router.get('/catalogos', turnoflexController.obtenerCatalogos);

// Packs y Congelamientos
router.get('/packs', requiereRolApi('cliente', 'coordinador', 'gerencia'), turnoflexController.listarPacks);
router.post('/packs', requiereRolApi('cliente', 'coordinador', 'gerencia'), turnoflexController.crearPack);
router.post('/packs/:id/congelar', requiereRolApi('cliente', 'coordinador', 'gerencia'), turnoflexController.solicitarCongelamiento);
router.post('/congelamientos/:id/resolver', requiereRolApi('coordinador', 'gerencia'), turnoflexController.resolverCongelamiento);

// Excepciones de Taller
router.get('/excepciones', requiereRolApi('operador', 'mecanico', 'coordinador', 'gerencia'), turnoflexController.listarExcepciones);
router.post('/excepciones', requiereRolApi('operador', 'mecanico', 'coordinador'), turnoflexController.solicitarExcepcion);
router.post('/excepciones/:id/resolver', requiereRolApi('coordinador', 'gerencia'), turnoflexController.resolverExcepcion);

// Liquidaciones Quincenales
router.get('/liquidaciones', requiereRolApi('coordinador', 'gerencia'), turnoflexController.obtenerLiquidaciones);

// Dashboard
router.get('/dashboard', requiereRolApi('recepcion', 'coordinador', 'gerencia'), turnoflexController.obtenerDashboard);

// Auditoría, Alertas y Reset Demo
router.get('/auditoria', requiereRolApi('coordinador', 'gerencia'), turnoflexController.obtenerAuditoriaYAlertas);
router.post('/alertas/generar', requiereRolApi('coordinador', 'gerencia'), turnoflexController.generarAlertasPendientes);
router.post('/reset-demo', requiereRolApi('coordinador', 'gerencia'), turnoflexController.resetearDemoTurnoFlex);

export default router;
