import { Request, Response, NextFunction } from 'express';

/**
 * Enum com todos os roles do sistema
 */
export enum UserRole {
  ADMIN_MASTER = 'admin_master',
  ADMIN_MINI = 'admin_mini',
  ADMIN_READ = 'admin_read',
  CLIENT_HOSPITAL = 'client_hospital',
  CLIENT_HOSPITAL_WORKER = 'client_hospital_worker',
  CLIENT_MEDIC = 'client_medic',
  COLLABORATOR = 'collaborator',
}

/**
 * Hierarquia de roles (maior número = mais permissões)
 */
const RoleHierarchy: Record<UserRole, number> = {
  [UserRole.ADMIN_MASTER]: 100,
  [UserRole.ADMIN_MINI]: 90,
  [UserRole.ADMIN_READ]: 80,
  [UserRole.CLIENT_HOSPITAL]: 70,
  [UserRole.CLIENT_HOSPITAL_WORKER]: 60,
  [UserRole.CLIENT_MEDIC]: 50,
  [UserRole.COLLABORATOR]: 40,
};

/**
 * Interface estendida do Request com informações do usuário
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: UserRole;
    hospitalId?: string;
    email?: string;
    name?: string;
  };
  ip: string;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
}

/**
 * Middleware de autorização baseado em roles (RBAC)
 * 
 * Valida se o usuário possui um dos roles permitidos
 * 
 * @param allowedRoles - Array de roles permitidos
 * @returns Middleware Express
 * 
 * @example
 * router.get('/pending', authorize([UserRole.CLIENT_HOSPITAL, UserRole.ADMIN_MASTER]), controller.listPending);
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    // Verificar se o usuário está autenticado
    if (!authReq.user || !authReq.user.role) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRole = authReq.user.role;

    // Verificar se o role do usuário está na lista de permitidos
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        userRole,
      });
    }

    return next();
  };
}

/**
 * Middleware de autorização baseado em hierarquia de roles
 * 
 * Valida se o usuário possui um role com nível hierárquico igual ou superior ao mínimo
 * 
 * @param minimumRole - Role mínimo necessário
 * @returns Middleware Express
 * 
 * @example
 * router.delete('/attendance/:id', authorizeMinimum(UserRole.ADMIN_MINI), controller.delete);
 */
export function authorizeMinimum(minimumRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user || !authReq.user.role) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRole = authReq.user.role;
    const userLevel = RoleHierarchy[userRole] || 0;
    const minimumLevel = RoleHierarchy[minimumRole] || 0;

    if (userLevel < minimumLevel) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Minimum role required: ${minimumRole}`,
        userRole,
        userLevel,
        requiredLevel: minimumLevel,
      });
    }

    return next();
  };
}

/**
 * Middleware para verificar se o usuário é admin
 * 
 * @returns Middleware Express
 */
export function authorizeAdmin() {
  return authorize([
    UserRole.ADMIN_MASTER,
    UserRole.ADMIN_MINI,
    UserRole.ADMIN_READ,
  ]);
}

/**
 * Middleware para verificar se o usuário é hospital (owner ou worker)
 * 
 * @returns Middleware Express
 */
export function authorizeHospital() {
  return authorize([
    UserRole.CLIENT_HOSPITAL,
    UserRole.CLIENT_HOSPITAL_WORKER,
    UserRole.ADMIN_MASTER,
    UserRole.ADMIN_MINI,
  ]);
}

/**
 * Middleware para verificar se o usuário é médico
 * 
 * @returns Middleware Express
 */
export function authorizeMedic() {
  return authorize([UserRole.CLIENT_MEDIC]);
}

/**
 * Middleware para validar ownership
 * 
 * Verifica se o recurso pertence ao usuário ou hospital do usuário
 * 
 * @param getResourceOwnerId - Função que extrai o ID do dono do recurso
 * @returns Middleware Express
 * 
 * @example
 * router.get('/attendance/:id', 
 *   authorizeOwnership((req) => req.params.doctorId), 
 *   controller.get
 * );
 */
export function authorizeOwnership(
  getResourceOwnerId: (req: AuthenticatedRequest) => string | undefined
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const resourceOwnerId = getResourceOwnerId(authReq);
    const userId = authReq.user.id;
    const userRole = authReq.user.role;

    // Admins podem acessar tudo
    if ([UserRole.ADMIN_MASTER, UserRole.ADMIN_MINI].includes(userRole)) {
      return next();
    }

    // Hospital pode acessar recursos do seu hospital
    if (
      [UserRole.CLIENT_HOSPITAL, UserRole.CLIENT_HOSPITAL_WORKER].includes(userRole) &&
      authReq.user.hospitalId === resourceOwnerId
    ) {
      return next();
    }

    // Médico pode acessar apenas seus próprios recursos
    if (userRole === UserRole.CLIENT_MEDIC && userId === resourceOwnerId) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this resource',
    });
  };
}

/**
 * Middleware para extrair IP do request
 * 
 * Extrai o IP real considerando proxies e load balancers
 */
export function extractIp(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  
  authReq.ip = 
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown';

  next();
}

/**
 * Middleware para extrair localização do request
 * 
 * Extrai latitude e longitude dos headers ou body
 */
export function extractLocation(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;

  const latitude = 
    parseFloat(req.headers['x-latitude'] as string) ||
    parseFloat(req.body?.latitude) ||
    undefined;

  const longitude = 
    parseFloat(req.headers['x-longitude'] as string) ||
    parseFloat(req.body?.longitude) ||
    undefined;

  if (latitude && longitude) {
    authReq.location = {
      latitude,
      longitude,
      city: req.headers['x-city'] as string,
      country: req.headers['x-country'] as string,
    };
  }

  next();
}

/**
 * Helper para verificar se o usuário tem permissão específica
 */
export function hasPermission(
  userRole: UserRole,
  requiredRoles: UserRole[]
): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Helper para verificar se o usuário tem nível hierárquico suficiente
 */
export function hasMinimumLevel(
  userRole: UserRole,
  minimumRole: UserRole
): boolean {
  const userLevel = RoleHierarchy[userRole] || 0;
  const minimumLevel = RoleHierarchy[minimumRole] || 0;
  return userLevel >= minimumLevel;
}

/**
 * Helper para verificar se o usuário é admin
 */
export function isAdmin(userRole: UserRole): boolean {
  return [
    UserRole.ADMIN_MASTER,
    UserRole.ADMIN_MINI,
    UserRole.ADMIN_READ,
  ].includes(userRole);
}

/**
 * Helper para verificar se o usuário é hospital
 */
export function isHospital(userRole: UserRole): boolean {
  return [
    UserRole.CLIENT_HOSPITAL,
    UserRole.CLIENT_HOSPITAL_WORKER,
  ].includes(userRole);
}

/**
 * Helper para verificar se o usuário é médico
 */
export function isMedic(userRole: UserRole): boolean {
  return userRole === UserRole.CLIENT_MEDIC;
}
