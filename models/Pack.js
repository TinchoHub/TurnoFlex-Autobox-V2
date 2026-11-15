import mongoose from 'mongoose';

const packSchema = new mongoose.Schema(
    {
        clienteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Cliente',
            required: [true, 'El cliente es obligatorio']
        },
        nombre: {
            type: String,
            required: [true, 'El nombre del pack es obligatorio'],
            trim: true,
            default: 'Pack Flota 10'
        },
        creditosTotales: {
            type: Number,
            required: true,
            default: 10,
            min: [1, 'El pack debe tener al menos 1 crédito']
        },
        creditosUsados: {
            type: Number,
            default: 0,
            min: 0
        },
        fechaInicio: {
            type: String,
            required: [true, 'La fecha de inicio es obligatoria'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha de inicio debe tener formato AAAA-MM-DD']
        },
        fechaFin: {
            type: String,
            required: [true, 'La fecha de fin es obligatoria'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha de fin debe tener formato AAAA-MM-DD']
        },
        estado: {
            type: String,
            enum: ['activo', 'congelado', 'agotado', 'vencido'],
            default: 'activo'
        },
        montoPagado: {
            type: Number,
            default: 520000,
            min: 0
        },
        pagadoEn: {
            type: String,
            default: () => new Date().toISOString()
        },
        activo: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model('Pack', packSchema);
