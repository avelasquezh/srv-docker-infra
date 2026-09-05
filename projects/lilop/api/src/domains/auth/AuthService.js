const BaseService = require('../../core/BaseService');

/**
 * Error de dominio: email inexistente, usuario inactivo, o password
 * incorrecto. El controller nunca distingue el caso puntual (mismo
 * comportamiento que el código viejo: siempre "Credenciales inválidas"
 * sin filtrar si el email existe o no).
 */
class CredencialesInvalidasError extends Error {}

/**
 * AuthService — reglas de negocio de login y listado de vendedores.
 * No conoce Express (req/res) ni SQL directo — recibe su repositorio
 * (this.repos.usuarios) y sus dependencias de criptografía/token por
 * constructor (mismo principio de inversión de dependencias que
 * ImagenRepository recibe sharp/fs: permite testear con bcrypt/jwt
 * falsos sin tocar hashing ni firmas reales).
 */
class AuthService extends BaseService {
  /**
   * @param {Record<string, import('../../core/BaseRepository')>} repositorios
   * @param {{ bcrypt: any, jwt: any, jwtSecret: string, expiresIn?: string }} deps
   */
  constructor(repositorios, deps) {
    super(repositorios);
    if (!deps || !deps.bcrypt || !deps.jwt || !deps.jwtSecret) {
      throw new Error('AuthService: se requieren bcrypt, jwt y jwtSecret inyectados');
    }
    this.bcrypt = deps.bcrypt;
    this.jwt = deps.jwt;
    this.jwtSecret = deps.jwtSecret;
    this.expiresIn = deps.expiresIn || '12h';
  }

  /**
   * Valida credenciales y devuelve { token, usuario }. Mismo contrato
   * exacto que el controller viejo (payload del JWT: id/nombre/email/rol).
   */
  async login(email, password) {
    const usuario = await this.repos.usuarios.buscarPorEmailActivo(email);
    if (!usuario) throw new CredencialesInvalidasError('Credenciales inválidas');

    const passwordValido = await this.bcrypt.compare(password, usuario.password);
    if (!passwordValido) throw new CredencialesInvalidasError('Credenciales inválidas');

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };
    const token = this.jwt.sign(payload, this.jwtSecret, { expiresIn: this.expiresIn });

    return { token, usuario: payload };
  }

  vendedores(rol) {
    return this.repos.usuarios.listarActivos(rol);
  }
}

module.exports = { AuthService, CredencialesInvalidasError };
