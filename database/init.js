import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

let db = null;

/**
 * Database yapısı
 */
const defaultData = {
  projects: [],
  port_usage: [],
  project_logs: [],
  api_stats: [],
  settings: {
    created_at: new Date().toISOString(),
    version: '1.0.0'
  }
};

/**
 * Database'i başlatır
 */
export async function initDatabase() {
  try {
    // Database klasörünü oluştur
    const dbDir = path.join(process.cwd(), 'database');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Database dosyasını oluştur
    const dbPath = path.join(dbDir, 'projects.json');
    const adapter = new JSONFile(dbPath);
    db = new Low(adapter, defaultData);
    
    // Database'i oku
    await db.read();
    
    // Eğer boşsa default data ile başlat
    if (!db.data) {
      db.data = defaultData;
      await db.write();
    }
    
    console.log('✅ Database başarıyla başlatıldı:', dbPath);
    return db;
  } catch (error) {
    console.error('❌ Database başlatma hatası:', error);
    throw error;
  }
}

/**
 * Database instance'ını döndürür
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database henüz başlatılmadı. initDatabase() çağırın.');
  }
  return db;
}

/**
 * Proje oluşturur
 */
export async function createProject(projectData) {
  const db = getDatabase();
  await db.read();
  
  db.data.projects.push(projectData);
  await db.write();
  
  return projectData;
}

/**
 * Proje bulur
 */
export async function findProject(id) {
  const db = getDatabase();
  await db.read();
  
  return db.data.projects.find(p => p.id === id);
}

/**
 * Proje günceller
 */
export async function updateProject(id, updates) {
  const db = getDatabase();
  await db.read();
  
  const projectIndex = db.data.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) return null;
  
  db.data.projects[projectIndex] = { ...db.data.projects[projectIndex], ...updates };
  await db.write();
  
  return db.data.projects[projectIndex];
}

/**
 * Proje istatistiklerini günceller
 */
export async function updateProjectStats(projectId, stats) {
  const db = getDatabase();
  await db.read();
  
  const projectIndex = db.data.projects.findIndex(p => p.id === projectId);
  if (projectIndex === -1) return null;
  
  // İstatistikleri güncelle
  const updates = {
    table_count: stats.table_count || db.data.projects[projectIndex].table_count || 0,
    last_accessed: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  db.data.projects[projectIndex] = { ...db.data.projects[projectIndex], ...updates };
  await db.write();
  
  return db.data.projects[projectIndex];
}

/**
 * Proje siler
 */
export async function deleteProject(id) {
  const db = getDatabase();
  await db.read();
  
  const projectIndex = db.data.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) return false;
  
  // Projeyi sil
  db.data.projects.splice(projectIndex, 1);
  
  // İlgili port kullanımlarını sil
  db.data.port_usage = db.data.port_usage.filter(p => p.project_id !== id);
  
  await db.write();
  return true;
}

/**
 * Projeleri listeler
 */
export async function listProjects(filters = {}) {
  const db = getDatabase();
  await db.read();
  
  let projects = [...db.data.projects];
  
  if (filters.status) {
    projects = projects.filter(p => p.status === filters.status);
  }
  
  if (filters.owner_id) {
    projects = projects.filter(p => p.owner_id === filters.owner_id);
  }
  
  // Tarihe göre sırala (en yeni ilk)
  projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  if (filters.limit) {
    projects = projects.slice(0, filters.limit);
  }
  
  return projects;
}

/**
 * Port kullanımı ekler
 */
export async function addPortUsage(portData) {
  const db = getDatabase();
  await db.read();
  
  db.data.port_usage.push({
    ...portData,
    allocated_at: new Date().toISOString()
  });
  
  await db.write();
}

/**
 * Port kullanımını siler
 */
export async function removePortUsage(projectId) {
  const db = getDatabase();
  await db.read();
  
  const removedPorts = db.data.port_usage.filter(p => p.project_id === projectId);
  db.data.port_usage = db.data.port_usage.filter(p => p.project_id !== projectId);
  
  await db.write();
  return removedPorts;
}

/**
 * Kullanılan portları döndürür
 */
export async function getUsedPorts() {
  const db = getDatabase();
  await db.read();
  
  return db.data.port_usage.map(pu => ({
    ...pu,
    project_name: db.data.projects.find(p => p.id === pu.project_id)?.name || 'Unknown'
  }));
}

/**
 * Proje portlarını döndürür
 */
export async function getProjectPorts(projectId) {
  const db = getDatabase();
  await db.read();
  
  const ports = db.data.port_usage.filter(p => p.project_id === projectId);
  const portMap = {};
  
  ports.forEach(p => {
    portMap[p.service_type + '_port'] = p.port;
  });
  
  return portMap;
}

/**
 * Log kaydı ekler
 */
export async function addLog(logData) {
  const db = getDatabase();
  await db.read();
  
  db.data.project_logs.push({
    id: Date.now(), // Basit ID için timestamp kullan
    ...logData,
    timestamp: new Date().toISOString()
  });
  
  // Logları 1000 ile sınırla (performans için)
  if (db.data.project_logs.length > 1000) {
    db.data.project_logs = db.data.project_logs.slice(-1000);
  }
  
  await db.write();
}

/**
 * Proje loglarını döndürür
 */
export async function getProjectLogs(projectId, filters = {}) {
  const db = getDatabase();
  await db.read();
  
  let logs = db.data.project_logs.filter(log => log.project_id === projectId);
  
  if (filters.action) {
    logs = logs.filter(log => log.action === filters.action);
  }
  
  // Tarihe göre sırala (en yeni ilk)
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (filters.limit) {
    logs = logs.slice(0, filters.limit);
  }
  
  return logs;
}

/**
 * API istatistik kaydı ekler
 */
export async function addApiStat(statData) {
  const db = getDatabase();
  await db.read();
  
  db.data.api_stats.push({
    id: Date.now(),
    ...statData,
    timestamp: new Date().toISOString()
  });
  
  // Son 24 saatin istatistiklerini tut
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.data.api_stats = db.data.api_stats.filter(stat => stat.timestamp > yesterday);
  
  await db.write();
}

/**
 * Genel istatistikleri döndürür
 */
export async function getStats() {
  const db = getDatabase();
  await db.read();
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  
  return {
    total_projects: db.data.projects.length,
    running_projects: db.data.projects.filter(p => p.status === 'running').length,
    stopped_projects: db.data.projects.filter(p => p.status === 'stopped').length,
    total_logs: db.data.project_logs.length,
    recent_actions: db.data.project_logs
      .filter(log => log.timestamp > yesterday)
      .reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
    api_calls_24h: db.data.api_stats.length
  };
}

/**
 * Database'i kapatır (LowDB için gerekli değil ama uyumluluk için)
 */
export function closeDatabase() {
  if (db) {
    console.log('✅ Database bağlantısı kapatıldı');
    db = null;
  }
}

// Process sonlandığında database'i kapat
process.on('exit', closeDatabase);
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase); 