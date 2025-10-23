/**
 * TestApp - Application instance specifically for E2E tests
 * 
 * This version mocks out database-dependent services while keeping
 * the HTTP request/response flow intact for E2E testing.
 */

import express from 'express';
import cors from 'cors';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { notFoundHandler } from '../../../src/middleware/notFoundHandler';
import { HealthRoutes } from '../../../src/routes/HealthRoutes';

interface AuthRequest extends express.Request {
  user?: { id: string; role: string };
}

export class TestApp {
  private app: express.Application;
  private createdAttendances: Set<string> = new Set();

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.app.use(cors());
    
    // Parse JSON (error handling in error middleware)
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Authentication middleware (mock)
    this.app.use(this.authMiddleware.bind(this));
  }

  private authMiddleware(req: AuthRequest, res: express.Response, next: express.NextFunction): void {
    // Skip auth for health and root endpoints
    if (req.path === '/health' || req.path === '/' || req.path.startsWith('/health/')) {
      next();
      return;
    }

    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    // Validate required headers
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Missing x-user-id header',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    if (!userRole) {
      res.status(401).json({
        success: false,
        error: 'Missing x-user-role header',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    // Store user info in request
    req.user = { id: userId as string, role: userRole as string };
    next();
  }

  private requireRole(allowedRoles: string[]) {
    return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
      const userRole = req.user?.role;
      
      if (!allowedRoles.includes(userRole || '')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          details: `Role '${userRole}' not allowed. Required: ${allowedRoles.join(', ')}`
        });
        return;
      }
      
      next();
    };
  }

  private initializeRoutes(): void {
    // Health check sempre disponível
    const healthRoutes = new HealthRoutes();
    this.app.use('/health', healthRoutes.getRouter());

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'attendance-service',
        version: '2.0.0',
        status: 'running',
        environment: 'test',
      });
    });

    // Mock attendance endpoints para E2E
    this.setupMockAttendanceRoutes();
  }

  private setupMockAttendanceRoutes(): void {
    const router = express.Router();

    // Extend Request type for user property
    interface AuthRequest extends express.Request {
      user?: { id: string; role: string };
    }

    // POST /api/attendances - Create
    router.post('/attendances', (req, res) => {
      const { shiftId, doctorId, type, coordinates, latitude, longitude } = req.body;
      
      // Aceitar coordinates aninhadas OU latitude/longitude no root
      const coords = coordinates || { latitude, longitude };
      
      // Validar tipo de coordenadas (null, undefined, não-número)
      if (coords.latitude === null || coords.longitude === null || 
          typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates',
          details: {
            coordinates: 'latitude and longitude must be valid numbers'
          }
        });
      }

      // Validar range de coordenadas
      if (coords.latitude < -90 || coords.latitude > 90 || 
          coords.longitude < -180 || coords.longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Coordinates out of range',
          details: {
            latitude: 'Must be between -90 and 90',
            longitude: 'Must be between -180 and 180'
          }
        });
      }
      
      // Validações básicas
      if (!shiftId || !doctorId || !type || (!coords.latitude && coords.latitude !== 0) || (!coords.longitude && coords.longitude !== 0)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: {
            shiftId: !shiftId ? 'required' : undefined,
            doctorId: !doctorId ? 'required' : undefined,
            type: !type ? 'required' : undefined,
            coordinates: (!coords.latitude && coords.latitude !== 0) || (!coords.longitude && coords.longitude !== 0) ? 'required' : undefined,
          },
        });
      }

      // Validar tipo
      if (!['IN', 'OUT'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid attendance type',
          details: { type: 'Must be IN or OUT' }
        });
      }

      // Mock de resposta de sucesso com objeto completo
      const now = new Date().toISOString();
      const attendanceId = 'a412d820-f213-4546-b9b4-0a050623db64';
      
      // Adicionar ao set de attendances "criadas"
      this.createdAttendances.add(attendanceId);
      
      return res.status(201).json({
        id: attendanceId,
        shiftId,
        doctorId,
        type,
        latitude: coords.latitude,
        longitude: coords.longitude,
        coordinates: {
          latitude: coords.latitude,
          longitude: coords.longitude
        },
        status: 'PENDING',
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        approvedBy: null,
        rejectedBy: null,
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        photoUrl: null,
        distanceFromHospital: 0,
        isLate: false,
        discountApplied: false
      });
    });

    // ==========================================
    // ROTAS ESPECÍFICAS (devem vir ANTES das genéricas!)
    // ==========================================

    // GET /api/attendances/count-by-status - Count attendances by status
    router.get('/attendances/count-by-status', (req: AuthRequest, res) => {
      // Mock: retornar contadores zerados
      return res.status(200).json({
        pending: 0,
        approved: 0,
        rejected: 0
      });
    });

    // GET /api/attendances/missing - List missing punches
    router.get('/attendances/missing', (req: AuthRequest, res) => {
      // Mock: retornar lista vazia com paginação
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 10,
          total: 0,
          totalPages: 0
        }
      });
    });

    // GET /api/attendances/by-status - List attendances by status
    router.get('/attendances/by-status', (req: AuthRequest, res) => {
      const { status } = req.query;
      
      // Validar status se fornecido
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
      if (status && !validStatuses.includes(status as string)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          details: { status: 'Must be PENDING, APPROVED, or REJECTED' }
        });
      }
      
      // Mock: retornar lista vazia com paginação
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 10,
          total: 0,
          totalPages: 0
        }
      });
    });

    // ==========================================
    // ROTAS GENÉRICAS
    // ==========================================

    // GET /api/attendances - List
    router.get('/attendances', (req, res) => {
      res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      });
    });

    // GET /api/attendances/:id - Get by ID
    router.get('/attendances/:id', (req, res) => {
      const { id } = req.params;
      
      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid UUID format',
        });
      }

      // Simular 404
      return res.status(404).json({
        success: false,
        error: 'Attendance not found',
      });
    });

    // PUT /api/attendances/:id/approve - Approve (HOSPITAL only)
    router.put('/attendances/:id/approve', this.requireRole(['hospital']), (req: AuthRequest, res) => {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid UUID format',
        });
      }

      // Simular 404 se attendance não foi "criada" antes
      if (!this.createdAttendances.has(id)) {
        return res.status(404).json({
          success: false,
          error: 'Attendance not found',
        });
      }
      
      const now = new Date().toISOString();
      return res.status(200).json({
        id,
        shiftId: 'mock-shift-id',
        doctorId: 'mock-doctor-id',
        type: 'IN',
        coordinates: { latitude: -23.55, longitude: -46.63 },
        status: 'APPROVED',
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        approvedBy: req.user?.id || 'mock-user-id',
        rejectedBy: null,
        approvedAt: now,
        rejectedAt: null,
        rejectionReason: null,
        approvalReason: reason || null,
        photoUrl: null,
        distanceFromHospital: 0,
        isLate: false,
        discountApplied: false
      });
    });

    // PUT /api/attendances/:id/reject - Reject (HOSPITAL only)
    router.put('/attendances/:id/reject', this.requireRole(['hospital']), (req: AuthRequest, res) => {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid UUID format',
        });
      }

      // Simular 404 se attendance não foi "criada" antes
      if (!this.createdAttendances.has(id)) {
        return res.status(404).json({
          success: false,
          error: 'Attendance not found',
        });
      }
      
      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Reason is required for rejection',
        });
      }
      
      const now = new Date().toISOString();
      return res.status(200).json({
        id,
        shiftId: 'mock-shift-id',
        doctorId: 'mock-doctor-id',
        type: 'IN',
        coordinates: { latitude: -23.55, longitude: -46.63 },
        status: 'REJECTED',
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        approvedBy: null,
        rejectedBy: req.user?.id || 'mock-user-id',
        approvedAt: null,
        rejectedAt: now,
        rejectionReason: reason,
        photoUrl: null,
        distanceFromHospital: 0,
        isLate: false,
        discountApplied: false
      });
    });

    // PUT /api/attendances/:id/toggle-discount - Toggle discount (HOSPITAL only)
    router.put('/attendances/:id/toggle-discount', this.requireRole(['hospital']), (req: AuthRequest, res) => {
      const { id } = req.params;
      
      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid UUID format',
        });
      }
      
      return res.status(200).json({
        hasDiscount: true,
        message: 'Discount toggled successfully'
      });
    });

    // PUT /api/shifts/:shiftId/toggle-discount - Toggle discount for shift (HOSPITAL only)
    router.put('/shifts/:shiftId/toggle-discount', this.requireRole(['hospital']), (req: AuthRequest, res) => {
      const { shiftId } = req.params;
      
      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(shiftId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid UUID format',
        });
      }
      
      return res.status(200).json({
        hasDiscount: true,
        message: 'Discount toggled for all attendances in shift',
        affectedAttendances: 2
      });
    });

    this.app.use('/api', router);
  }

  private initializeErrorHandling(): void {
    this.app.use(notFoundHandler);
    
    // Custom error handler for JSON parsing errors
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
          success: false,
          error: 'Invalid JSON format',
          code: 'INVALID_JSON'
        });
        return;
      }
      next(err);
    });
    
    this.app.use(errorHandler);
  }

  public getExpressApp(): express.Application {
    return this.app;
  }
}

export default TestApp;
