// app.js valida el JWT en cada request y carga req.usuario (o lo deja sin definir).
// Estos middlewares solo consultan ese resultado: no repiten la consulta a MongoDB.

export const rutaInicioPorRol = (rol) => {
  switch (rol) {
    case "mecanico":
      return "/taller";
    case "recepcion":
      return "/recepcion";
    case "coordinador":
      return "/coordinacion";
    case "gerencia":
      return "/dashboard";
    default:
      return "/";
  }
};

export const obtenerPermisosPorRol = (rol) => {
  const es = (...roles) => roles.includes(rol);
  return {
    inicio: es("admin", "operador", "cliente", "recepcion", "coordinador", "gerencia"),
    clientes: es("admin", "operador", "recepcion", "coordinador", "gerencia"),
    vehiculos: es("admin", "operador", "cliente", "recepcion", "coordinador", "gerencia"),
    turnos: es("admin", "operador", "cliente", "recepcion", "coordinador", "gerencia"),
    packs: es("admin", "cliente", "coordinador", "gerencia"),
    recepcion: es("admin", "operador", "recepcion", "coordinador", "gerencia"),
    taller: es("admin", "operador", "mecanico", "coordinador"),
    coordinacion: es("admin", "coordinador", "gerencia"),
    liquidaciones: es("admin", "coordinador", "gerencia"),
    dashboard: es("admin", "recepcion", "coordinador", "gerencia"),
    auditoria: es("admin", "coordinador", "gerencia"),
    usuarios: es("admin"),
    verRecaudacion: es("admin", "coordinador", "gerencia")
  };
};

// Vistas web: sin sesión válida, redirige al login
const protegerRuta = (req, res, next) => {
  if (!req.usuario) return res.redirect("/login");
  next();
};

// API REST: sin sesión válida, responde 401 en JSON (no redirige)
const protegerApi = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ mensaje: "Autenticación requerida" });
  }
  next();
};

// Restringe el acceso exclusivamente al rol 'admin'
const esAdmin = (req, res, next) => {
  if (!req.usuario) return res.redirect("/login");

  if (req.usuario.rol !== "admin") {
    return res.status(403).render("404", {
      titulo: "Acceso Denegado",
      mensaje: "No tenés permisos de administrador para gestionar usuarios."
    });
  }
  next();
};

// Restringe vistas web a una lista de roles permitidos (admin siempre tiene acceso)
const requiereRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) return res.redirect("/login");
    if (req.usuario.rol === "admin" || rolesPermitidos.includes(req.usuario.rol)) {
      return next();
    }
    return res.status(403).render("404", {
      titulo: "Acceso Denegado",
      mensaje: `El perfil "${req.usuario.rol}" no tiene permisos para acceder a este módulo.`
    });
  };
};

// Restringe endpoints de API a una lista de roles permitidos (admin siempre tiene acceso)
const requiereRolApi = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: "Autenticación requerida" });
    }
    if (req.usuario.rol === "admin" || rolesPermitidos.includes(req.usuario.rol)) {
      return next();
    }
    return res.status(403).json({
      mensaje: `El rol "${req.usuario.rol}" no tiene permisos para realizar esta operación.`
    });
  };
};

export {
  protegerRuta,
  protegerApi,
  esAdmin,
  requiereRol,
  requiereRolApi
};
