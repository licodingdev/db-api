import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { 
  findProject, 
  getProjectLogs,
  updateProjectStats
} from '../database/init.js';
import { 
  getProjectDbConfig,
  validateProjectAccess
} from '../services/projectManager.js';
import {
  createTable,
  listTables,
  getTableSchema,
  executeQuery,
  insertRecord,
  selectRecords,
  updateRecord,
  deleteRecord
} from '../services/databaseManager.js';

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
 * Database erişim doğrulama middleware
 */
async function validateDatabaseAccess(req, res, next) {
  try {
    const project = await findProject(req.params.projectId);
    const password = req.headers['x-database-password'] || req.body.password;
    
    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    if (!password) {
      return res.status(401).json({ 
        error: 'Database şifresi gerekli',
        details: 'X-Database-Password header\'ı veya password body parametresi gönderiniz'
      });
    }
    
    validateProjectAccess(project, password);
    
    req.project = project;
    req.dbConfig = getProjectDbConfig(project);
    
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}

/**
 * POST /api/database/:projectId/tables
 * Yeni tablo oluşturur
 */
router.post('/:projectId/tables',
  [
    param('projectId')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si'),
    body('tableName')
      .isLength({ min: 1, max: 63 })
      .withMessage('Tablo adı 1-63 karakter arasında olmalı')
      .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      .withMessage('Tablo adı harf ile başlamalı ve sadece harf, rakam, alt çizgi içerebilir'),
    body('columns')
      .isArray({ min: 1 })
      .withMessage('En az bir kolon tanımlanmalı'),
    body('columns.*.name')
      .isLength({ min: 1, max: 63 })
      .withMessage('Kolon adı 1-63 karakter arasında olmalı'),
    body('columns.*.type')
      .isIn([
        'SERIAL', 'INTEGER', 'BIGINT', 'SMALLINT',
        'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
        'VARCHAR', 'CHAR', 'TEXT',
        'BOOLEAN',
        'DATE', 'TIME', 'TIMESTAMP',
        'JSON', 'JSONB'
      ])
      .withMessage('Geçersiz veri tipi')
  ],
  validateRequest,
  validateDatabaseAccess,
  async (req, res, next) => {
    try {
      const { tableName, columns } = req.body;
      
      const result = await createTable(req.dbConfig, tableName, columns);
      
      // Tablo sayısını güncelle
      const tables = await listTables(req.dbConfig);
      await updateProjectStats(req.project.id, { table_count: tables.length });
      
      res.status(201).json({
        message: 'Tablo başarıyla oluşturuldu',
        table: result.table,
        columns: columns
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/database/:projectId/tables
 * Tabloları listeler
 */
router.get('/:projectId/tables',
  [
    param('projectId')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si')
  ],
  validateRequest,
  validateDatabaseAccess,
  async (req, res, next) => {
    try {
      const tables = await listTables(req.dbConfig);
      
      res.json({
        tables,
        count: tables.length
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/database/:projectId/tables/:tableName/schema
 * Tablo şemasını getirir
 */
router.get('/:projectId/tables/:tableName/schema',
  [
    param('projectId')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si'),
    param('tableName')
      .isLength({ min: 1, max: 63 })
      .withMessage('Geçersiz tablo adı')
  ],
  validateRequest,
  validateDatabaseAccess,
  async (req, res, next) => {
    try {
      const schema = await getTableSchema(req.dbConfig, req.params.tableName);
      
      res.json({
        table: req.params.tableName,
        columns: schema
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/database/:projectId/query
 * SQL sorgusu çalıştırır
 */
router.post('/:projectId/query',
  [
    param('projectId')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si'),
    body('sql')
      .isLength({ min: 1, max: 10000 })
      .withMessage('SQL sorgusu 1-10000 karakter arasında olmalı'),
    body('params')
      .optional()
      .isArray()
      .withMessage('Parametreler array formatında olmalı')
  ],
  validateRequest,
  validateDatabaseAccess,
  async (req, res, next) => {
    try {
      const { sql, params = [] } = req.body;
      
      const result = await executeQuery(req.dbConfig, sql, params);
      
      res.json({
        result: {
          rows: result.rows,
          rowCount: result.rowCount,
          command: result.command,
          fields: result.fields
        },
        query: sql,
        executedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/database/:projectId/tables/:tableName/records
 * Tabloya kayıt ekler
 */
router.post('/:projectId/tables/:tableName/records',
  [
    param('projectId')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si'),
    param('tableName')
      .isLength({ min: 1, max: 63 })
      .withMessage('Geçersiz tablo adı'),
    body('data')
      .isObject()
      .withMessage('Data objesi gerekli')
  ],
  validateRequest,
  validateDatabaseAccess,
  async (req, res, next) => {
    try {
      const record = await insertRecord(
        req.dbConfig, 
        req.params.tableName, 
        req.body.data
      );
      
      res.status(201).json({
        message: 'Kayıt başarıyla eklendi',
        record
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/database/:projectId/tables/:tableName/records
 * Tablo kayıtlarını getirir
 */
router.get('/:projectId/tables/:tableName/records',
  [
    param('projectId')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si'),
    param('tableName')
      .isLength({ min: 1, max: 63 })
      .withMessage('Geçersiz tablo adı'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit 1-1000 arasında olmalı'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset 0 veya pozitif bir sayı olmalı'),
    query('orderBy')
      .optional()
      .isLength({ min: 1, max: 63 })
      .withMessage('OrderBy geçersiz'),
    query('orderDirection')
      .optional()
      .isIn(['ASC', 'DESC'])
      .withMessage('OrderDirection ASC veya DESC olmalı')
  ],
  validateRequest,
  validateDatabaseAccess,
  async (req, res, next) => {
    try {
      const conditions = {};
      const options = {
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0,
        orderBy: req.query.orderBy,
        orderDirection: req.query.orderDirection
      };
      
      // WHERE koşullarını query parametrelerinden al
      Object.keys(req.query).forEach(key => {
        if (!['limit', 'offset', 'orderBy', 'orderDirection'].includes(key)) {
          conditions[key] = req.query[key];
        }
      });
      
      const records = await selectRecords(
        req.dbConfig,
        req.params.tableName,
        conditions,
        options
      );
      
      res.json({
        records,
        count: records.length,
        conditions,
        options
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/database/:projectId/tables/:tableName/records/:id
 * Kayıt günceller
 */
router.put('/:projectId/tables/:tableName/records/:id',
  [
    param('projectId')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si'),
    param('tableName')
      .isLength({ min: 1, max: 63 })
      .withMessage('Geçersiz tablo adı'),
    param('id')
      .isNumeric()
      .withMessage('Geçersiz kayıt ID\'si'),
    body('data')
      .isObject()
      .withMessage('Data objesi gerekli')
  ],
  validateRequest,
  validateDatabaseAccess,
  async (req, res, next) => {
    try {
      const record = await updateRecord(
        req.dbConfig,
        req.params.tableName,
        parseInt(req.params.id),
        req.body.data
      );
      
      if (!record) {
        return res.status(404).json({ error: 'Kayıt bulunamadı' });
      }
      
      res.json({
        message: 'Kayıt başarıyla güncellendi',
        record
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/database/:projectId/tables/:tableName/records/:id
 * Kayıt siler
 */
router.delete('/:projectId/tables/:tableName/records/:id',
  [
    param('projectId')
      .isUUID()
      .withMessage('Geçersiz proje ID\'si'),
    param('tableName')
      .isLength({ min: 1, max: 63 })
      .withMessage('Geçersiz tablo adı'),
    param('id')
      .isNumeric()
      .withMessage('Geçersiz kayıt ID\'si')
  ],
  validateRequest,
  validateDatabaseAccess,
  async (req, res, next) => {
    try {
      const record = await deleteRecord(
        req.dbConfig,
        req.params.tableName,
        parseInt(req.params.id)
      );
      
      if (!record) {
        return res.status(404).json({ error: 'Kayıt bulunamadı' });
      }
      
      res.json({
        message: 'Kayıt başarıyla silindi',
        deletedRecord: record
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router; 