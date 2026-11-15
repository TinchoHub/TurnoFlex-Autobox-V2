import express from 'express';
import * as turnosController from '../controllers/turnosController.js';

const router = express.Router();

// Listar todos los turnos
router.get('/', turnosController.listarTurnos);

// Consultar disponibilidad de horarios (mecánico + box)
router.get('/disponibilidad', turnosController.consultarDisponibilidad);

// Crear un turno nuevo
router.post('/', turnosController.crearTurno);

// Cambiar estado operativo de un turno (Check-in, No-show, Iniciar, Completar)
router.patch('/:id/estado', turnosController.cambiarEstadoTurno);

// Consultar un turno por ID
router.get('/:id', turnosController.consultarTurnoPorId);

// Cancelar/Eliminar un turno por ID
router.delete('/:id', turnosController.cancelarTurnoPorId);

// Modificar o actualizar un turno por ID
router.put('/:id', turnosController.actualizarTurno);

export default router;
