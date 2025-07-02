import { getDatabase, addPortUsage, removePortUsage, getUsedPorts as dbGetUsedPorts, getProjectPorts as dbGetProjectPorts } from '../database/init.js';
import net from 'net';

/**
 * Port Yönetim Servisi
 * Otomatik port tahsisi ve yönetimi yapar
 */

// Port aralıkları
const PORT_RANGES = {
  api: { start: 55000, end: 55999 },      // API portları
  db: { start: 56000, end: 56999 },       // Database portları  
  studio: { start: 57000, end: 57999 },   // Studio portları
  inbucket: { start: 58000, end: 58999 }, // Email test portları
  analytics: { start: 59000, end: 59999 } // Analytics portları
};

/**
 * Belirtilen porttun kullanılabilir olup olmadığını kontrol eder
 */
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Belirtilen aralıkta boş port bulur
 */
async function findAvailablePort(serviceType) {
  const range = PORT_RANGES[serviceType];
  if (!range) {
    throw new Error(`Bilinmeyen servis tipi: ${serviceType}`);
  }

  // Database'den kullanılmakta olan portları al
  const usedPortsData = await dbGetUsedPorts();
  const usedPorts = usedPortsData
    .filter(p => p.service_type === serviceType)
    .map(p => p.port);

  // Aralıkta boş port ara
  for (let port = range.start; port <= range.end; port++) {
    // Database'de kullanılmıyor mu?
    if (usedPorts.includes(port)) continue;
    
    // Sistem tarafından kullanılabilir mi?
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  throw new Error(`${serviceType} için boş port bulunamadı (${range.start}-${range.end})`);
}

/**
 * Proje için gerekli tüm portları tahsis eder
 */
export async function allocatePorts(projectId) {
  try {
    // Her servis tipi için port bul
    const ports = {};
    for (const serviceType of ['api', 'db', 'studio', 'inbucket', 'analytics']) {
      ports[serviceType] = await findAvailablePort(serviceType);
    }

    // Portları database'e kaydet
    for (const [serviceType, port] of Object.entries(ports)) {
      await addPortUsage({
        port,
        project_id: projectId,
        service_type: serviceType,
        status: 'active'
      });
    }
    
    console.log(`✅ Portlar tahsis edildi:`, ports);
    return {
      api_port: ports.api,
      db_port: ports.db,
      studio_port: ports.studio,
      inbucket_port: ports.inbucket,
      analytics_port: ports.analytics
    };
    
  } catch (error) {
    console.error('❌ Port tahsis hatası:', error);
    throw error;
  }
}

/**
 * Proje portlarını serbest bırakır
 */
export async function deallocatePorts(projectId) {
  try {
    const removedPorts = await removePortUsage(projectId);
    
    if (removedPorts.length === 0) {
      console.log(`⚠️  ${projectId} için aktif port bulunamadı`);
      return;
    }
    
    console.log(`✅ ${removedPorts.length} port serbest bırakıldı:`, 
      removedPorts.map(p => `${p.service_type}:${p.port}`).join(', '));
    
    return removedPorts;
    
  } catch (error) {
    console.error('❌ Port serbest bırakma hatası:', error);
    throw error;
  }
}

/**
 * Kullanılan tüm portları listeler
 */
export async function getUsedPorts() {
  try {
    return await dbGetUsedPorts();
  } catch (error) {
    console.error('❌ Port listesi hatası:', error);
    throw error;
  }
}

/**
 * Port kullanım istatistiklerini döndürür
 */
export async function getPortStats() {
  try {
    const usedPorts = await dbGetUsedPorts();
    const stats = {};
    
    for (const [serviceType, range] of Object.entries(PORT_RANGES)) {
      const used = usedPorts.filter(p => p.service_type === serviceType).length;
      const total = range.end - range.start + 1;
      
      stats[serviceType] = {
        used,
        available: total - used,
        total,
        usage_percentage: Math.round((used / total) * 100),
        range: `${range.start}-${range.end}`
      };
    }
    
    return stats;
    
  } catch (error) {
    console.error('❌ Port istatistik hatası:', error);
    throw error;
  }
}

/**
 * Belirli bir projenin portlarını döndürür
 */
export async function getProjectPorts(projectId) {
  try {
    return await dbGetProjectPorts(projectId);
  } catch (error) {
    console.error('❌ Proje port listesi hatası:', error);
    throw error;
  }
} 