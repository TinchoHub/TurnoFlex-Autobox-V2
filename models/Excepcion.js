import mongoose from 'mongoose';

const excepcionSchema = new mongoose.Schema(
    {
        solicitadoPor: {
            type: String,
            required: true,
            trim: true,
            default: 'Mecánico'
        },
        sucursalId: {
            type: String,
            required: true,
            trim: true,
            default: 'norte'
        },
        motivo: {
            type: String,
            required: [true, 'El motivo de la excepción es obligatorio'],
            trim: true
        },
        estado: {
            type: String,
            enum: ['pendiente', 'aprobada', 'rechazada'],
            default: 'pendiente'
        },
        resueltoPor: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model('Excepcion', excepcionSchema);
