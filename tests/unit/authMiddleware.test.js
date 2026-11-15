import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    protegerApi,
    protegerRuta,
    esAdmin,
    requiereRol,
    requiereRolApi,
    rutaInicioPorRol
} from '../../middlewares/authMiddleware.js';

// Respuesta simulada con los métodos que usan los middlewares
const crearRes = () => {
    const res = { codigo: 200, cuerpo: null, destino: null };
    res.status = (c) => { res.codigo = c; return res; };
    res.json = (b) => { res.cuerpo = b; return res; };
    res.render = (vista, b) => { res.cuerpo = { vista, ...b }; return res; };
    res.redirect = (u) => { res.destino = u; return res; };
    return res;
};

describe('authMiddleware', () => {
    it('protegerApi responde 401 JSON si no hay usuario', () => {
        const res = crearRes();
        protegerApi({}, res, () => assert.fail('no debe continuar'));
        assert.equal(res.codigo, 401);
        assert.ok(res.cuerpo.mensaje);
    });

    it('protegerApi continúa si hay usuario', () => {
        let continuo = false;
        protegerApi({ usuario: { rol: 'operador' } }, crearRes(), () => { continuo = true; });
        assert.equal(continuo, true);
    });

    it('protegerRuta redirige a /login si no hay usuario', () => {
        const res = crearRes();
        protegerRuta({}, res, () => assert.fail('no debe continuar'));
        assert.equal(res.destino, '/login');
    });

    it('esAdmin rechaza con 403 a un operador', () => {
        const res = crearRes();
        esAdmin({ usuario: { rol: 'operador' } }, res, () => assert.fail('no debe continuar'));
        assert.equal(res.codigo, 403);
    });

    it('esAdmin deja pasar a un admin', () => {
        let continuo = false;
        esAdmin({ usuario: { rol: 'admin' } }, crearRes(), () => { continuo = true; });
        assert.equal(continuo, true);
    });

    it('requiereRol y requiereRolApi aplican la matriz de permisos de TurnoFlex', () => {
        const mwDashboard = requiereRol('recepcion', 'coordinador', 'gerencia');
        const resMec = crearRes();
        mwDashboard({ usuario: { rol: 'mecanico' } }, resMec, () => assert.fail('mecánico no debe entrar a dashboard'));
        assert.equal(resMec.codigo, 403);

        let pasoCoord = false;
        mwDashboard({ usuario: { rol: 'coordinador' } }, crearRes(), () => { pasoCoord = true; });
        assert.equal(pasoCoord, true);

        const mwApiLiq = requiereRolApi('coordinador', 'gerencia');
        const resRec = crearRes();
        mwApiLiq({ usuario: { rol: 'recepcion' } }, resRec, () => assert.fail('recepción no debe entrar a liquidaciones'));
        assert.equal(resRec.codigo, 403);
    });

    it('rutaInicioPorRol asigna la vista inicial correcta a cada rol', () => {
        assert.equal(rutaInicioPorRol('mecanico'), '/taller');
        assert.equal(rutaInicioPorRol('recepcion'), '/recepcion');
        assert.equal(rutaInicioPorRol('coordinador'), '/coordinacion');
        assert.equal(rutaInicioPorRol('gerencia'), '/dashboard');
        assert.equal(rutaInicioPorRol('admin'), '/');
    });
});
