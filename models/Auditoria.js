import mongoose from 'mongoose';

const auditoriaSchema = new mongoose.Schema(
    {
        actor: {
            type: String,
            required: true,
            trim: true,
            default: 'sistema'
        },
        accion: {
            type: String,
            required: true,
            trim: true
        },
        detalle: {
            type: String,
            required: true,
            trim: true
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

export default mongoose.model('Auditoria', auditoriaSchema);
