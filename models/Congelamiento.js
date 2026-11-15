import mongoose from 'mongoose';

const congelamientoSchema = new mongoose.Schema(
    {
        packId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Pack',
            required: [true, 'El pack es obligatorio']
        },
        solicitadoPor: {
            type: String,
            required: true,
            trim: true,
            default: 'Cliente'
        },
        aprobadoPor: {
            type: String,
            trim: true,
            default: ''
        },
        dias: {
            type: Number,
            required: [true, 'La cantidad de días es obligatoria'],
            min: [1, 'El mínimo es 1 día'],
            max: [30, 'El máximo es 30 días']
        },
        motivo: {
            type: String,
            required: [true, 'El motivo es obligatorio'],
            trim: true
        },
        estado: {
            type: String,
            enum: ['pendiente', 'aprobado', 'rechazado'],
            default: 'pendiente'
        },
        nuevaFechaFin: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model('Congelamiento', congelamientoSchema);
