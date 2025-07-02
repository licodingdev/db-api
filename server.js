import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createLogger, format, transports } from 'winston';

import projectRoutes from './routes/projects.js';
import databaseRoutes from './routes/database.js';
import { initDatabase } from './database/init.js';
import { initMasterConnection } from './services/databaseManager.js';
import { errorHandler } from './middleware/errorHandler.js';

// Environment variables
dotenv.config();

// Logger konfigürasyonu
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // Her IP için maksimum 100 request
  message: {
    error: 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.'
  }
});

// Middleware'ler
app.use(helmet()); // Güvenlik header'ları
app.use(cors()); // CORS
app.use(limiter); // Rate limiting
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Ana route'lar
app.use('/api/projects', projectRoutes);
app.use('/api/database', databaseRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.json({
    message: '🚀 PostgreSQL Project Manager API',
    version: '1.0.0',
    description: 'Her proje için ayrı PostgreSQL database oluşturan ve yöneten API',
    documentation: '/api/docs',
    endpoints: {
      health: '/health',
      projects: {
        create: 'POST /api/projects',
        list: 'GET /api/projects',
        get: 'GET /api/projects/:id',
        delete: 'DELETE /api/projects/:id'
      },
      database: {
        create_table: 'POST /api/database/:projectId/tables',
        list_tables: 'GET /api/database/:projectId/tables',
        table_schema: 'GET /api/database/:projectId/tables/:tableName/schema',
        execute_query: 'POST /api/database/:projectId/query',
        insert_record: 'POST /api/database/:projectId/tables/:tableName/records',
        get_records: 'GET /api/database/:projectId/tables/:tableName/records',
        update_record: 'PUT /api/database/:projectId/tables/:tableName/records/:id',
        delete_record: 'DELETE /api/database/:projectId/tables/:tableName/records/:id'
      }
    },
    authentication: {
      description: 'Database işlemleri için X-Database-Password header\'ı veya password body parametresi gereklidir',
      example: 'X-Database-Password: your-database-password'
    }
  });
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint bulunamadı',
    path: req.originalUrl,
    method: req.method
  });
});

// Server başlatma
async function startServer() {
  try {
    // Local JSON database'i başlat
    await initDatabase();
    logger.info('Local database başarıyla başlatıldı');

    // PostgreSQL master bağlantısını başlat
    await initMasterConnection();
    logger.info('PostgreSQL master bağlantısı başarıyla başlatıldı');

    // Server'ı başlat
    app.listen(PORT, () => {
      logger.info(`🚀 Server ${PORT} portunda çalışıyor`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/`);
      logger.info(`❤️  Health Check: http://localhost:${PORT}/health`);
      logger.info(`🐘 PostgreSQL Project Manager hazır!`);
    });
  } catch (error) {
    logger.error('Server başlatma hatası:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM alındı, server kapatılıyor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT alındı, server kapatılıyor...');
  process.exit(0);
});

// Server'ı başlat
startServer();

export default app; 