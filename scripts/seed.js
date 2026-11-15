// Crea el primer administrador si todavía no existe ninguno y carga los datos semilla de TurnoFlex · AutoBox.
// Uso: npm run seed   (requiere SEED_ADMIN_USER y SEED_ADMIN_PASSWORD en .env)
import 'dotenv/config';
import mongoose from 'mongoose';
import Usuario from '../models/Usuario.js';
import { cargarSemillaTurnoFlex } from '../services/turnoflexEngine.js';

const { MONGODB_URI, SEED_ADMIN_USER, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME } = process.env;

const ejecutarSeed = async () => {
    if (!MONGODB_URI || !SEED_ADMIN_USER || !SEED_ADMIN_PASSWORD) {
        console.error('Faltan MONGODB_URI, SEED_ADMIN_USER o SEED_ADMIN_PASSWORD en el .env');
        process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);

    const hayAdmin = await Usuario.exists({ rol: 'admin', activo: true });
    if (hayAdmin) {
        console.log('Ya existe un administrador activo: no se modificaron usuarios.');
    } else {
        // El hash de la contraseña lo genera el pre-save del modelo Usuario
        await Usuario.create({
            username: SEED_ADMIN_USER,
            password: SEED_ADMIN_PASSWORD,
            nombre: SEED_ADMIN_NAME || 'Administrador',
            rol: 'admin'
        });
        console.log(`Administrador "${SEED_ADMIN_USER.toLowerCase()}" creado correctamente.`);
    }

    // Perfiles demo de TurnoFlex · AutoBox (misma clave del seed para facilitar pruebas)
    const perfilesDemo = [
        { username: 'recepcion', nombre: 'Lucía Benítez (Recepción Norte)', rol: 'recepcion', sucursalId: 'norte' },
        { username: 'mecanico', nombre: 'Diego Rivas (Mecánico Norte)', rol: 'mecanico', sucursalId: 'norte', mecanicoId: 'm1' },
        { username: 'coordinador', nombre: 'Jorge Palacios (Coordinador Norte)', rol: 'coordinador', sucursalId: 'norte' },
        { username: 'gerencia', nombre: 'Elena Varela (Gerencia)', rol: 'gerencia' },
        { username: 'cliente', nombre: 'Ana Gómez (Cliente)', rol: 'cliente' },
        { username: 'operador', nombre: 'Operador AutoBox', rol: 'operador', sucursalId: 'norte' }
    ];

    for (const p of perfilesDemo) {
        const existe = await Usuario.exists({ username: p.username });
        if (!existe) {
            await Usuario.create({
                ...p,
                password: SEED_ADMIN_PASSWORD
            });
            console.log(`Usuario demo "${p.username}" (${p.rol}) creado.`);
        }
    }

    const forzar = process.argv.includes('--reset');
    const resultadoSemilla = await cargarSemillaTurnoFlex({ forzar });
    if (resultadoSemilla.creado) {
        console.log('Semilla de datos TurnoFlex · AutoBox cargada correctamente (clientes, vehículos, packs, turnos, auditoría y alertas).');
    } else {
        console.log('La base de datos ya contiene clientes (usar "npm run seed -- --reset" para recargar la semilla demo).');
    }

    await mongoose.disconnect();
};

ejecutarSeed().catch((error) => {
    console.error('Error en el seed:', error.message);
    process.exit(1);
});
