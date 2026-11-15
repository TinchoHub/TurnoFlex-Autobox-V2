import mongoose from 'mongoose';

const alertaSchema = new mongoose.Schema(
    {
        canal: {
            type: String,
            enum: ['portal', 'email'],
            default: 'portal'
        },
        destinatario: {
            type: String,
            required: true,
            trim: true
        },
        tipo: {
            type: String,
            enum: ['turno_24h', 'turno_2h', 'pack_7d', 'pack_2d'],
            required: true
        },
        mensaje: {
            type: String,
            required: true,
            trim: true
        },
        resultado: {
            type: String,
            enum: ['enviado', 'fallido', 'reintento'],
            default: 'enviado'
        },
        turnoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Turno',
            default: null
        },
        packId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Pack',
            default: null
        },
        fecha: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model('Alerta', alertaSchema);
