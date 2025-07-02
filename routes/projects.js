import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import {
  createProject,
  deleteProject,
  listProjects
} from '../services/projectManager.js';
import { 
  getDatabase, 
  findProject, 
  getProjectLogs,
  getStats
} from '../database/init.js';

const router = express.Router();

/**
 * Validation middleware
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Geçersiz veri',
      details: errors.array()
    });
  }
  next();
}

/**
 * POST /api/projects
 * Yeni PostgreSQL projesi oluşturur
 */
router.post('/',
  [
    body('name')
      .isLength({ min: 2, max: 50 })
      .withMessage('Proje adı 2-50 karakter arasında olmalı')
      .matches(/^[a-zA-Z0-9\s-]+$/)
      .withMessage('Proje adı sadece harf, rakam, tire ve boşluk içerebilir'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Açıklama maksimum 200 karakter olabilir'),
    body('owner_id')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Sahip ID\'si geçersiz'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Etiketler array formatında olmalı'),
    body('environment')
      .optional()
      .isIn(['development', 'staging', 'production'])
      .withMessage('Environment development, staging veya production olmalı')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const project = await createProject(req.body);
      
      res.status(201).json({
        message: 'PostgreSQL projesi başarıyla oluşturuldu',
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          connection_string: project.connection_string,
          database_name: project.database_name,
          database_username: project.database_username,
          database_password: project.database_password,
          database_host: project.database_host,
          database_port: project.database_port,
          created_at: project.created_at,
          environment: project.environment,
          tags: project.tags
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/projects
 * Tüm projeleri listeler
 */
router.get('/',
  [
    query('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status active veya inactive olmalı'),
    query('owner_id')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Sahip ID\'si geçersiz'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalı')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const filters = {
        status: req.query.status,
        owner_id: req.query.owner_id,
        limit: parseInt(req.query.limit) || 50
      };
      
      const projects = await listProjects(filters);
      
      // Hassas bilgileri gizle (şifreyi gizle)
      const publicProjects = projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        database_name: project.database_name,
        database_username: project.database_username,
        database_host: project.database_host,
        database_port: project.database_port,
        created_at: project.created_at,
        updated_at: project.updated_at,
        last_accessed: project.last_accessed,
        environment: project.environment,
        table_count: project.table_count,
        tags: project.tags || []
      }));
      
      res.json({
        projects: publicProjects,
        count: publicProjects.length,
        filters
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/projects/:id
 * Belirli bir projeyi getirir
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const project = await findProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({
          error: 'Proje bulunamadı'
        });
      }
      
      res.json({
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          connection_string: project.connection_string,
          database_name: project.database_name,
          database_username: project.database_username,
          database_password: project.database_password,
          database_host: project.database_host,
          database_port: project.database_port,
          created_at: project.created_at,
          updated_at: project.updated_at,
          last_accessed: project.last_accessed,
          environment: project.environment,
          table_count: project.table_count,
          tags: project.tags || []
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/projects/:id
 * Projeyi siler
 */
router.delete('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const result = await deleteProject(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/projects/:id/logs
 * Proje loglarını getirir
 */
router.get('/:id/logs',
  [
    param('id')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit 1-1000 arasında olmalı'),
    query('action')
      .optional()
      .isIn(['CREATE', 'UPDATE', 'DELETE'])
      .withMessage('Action CREATE, UPDATE veya DELETE olmalı')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const filters = {
        action: req.query.action,
        limit: parseInt(req.query.limit) || 100
      };
      
      const logs = await getProjectLogs(req.params.id, filters);
      
      res.json({
        logs,
        count: logs.length
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/projects/stats/overview
 * Genel istatistikler
 */
router.get('/stats/overview', async (req, res, next) => {
  try {
    const stats = await getStats();
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router; 