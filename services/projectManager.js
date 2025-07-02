import { v4 as uuidv4 } from 'uuid';
import { execSync, spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { 
  getDatabase, 
  createProject as dbCreateProject,
  findProject,
  updateProject,
  deleteProject as dbDeleteProject,
  listProjects as dbListProjects,
  addLog
} from '../database/init.js';
import { allocatePorts, deallocatePorts, getProjectPorts } from './portManager.js';
import { 
  createProjectDatabase,
  dropProjectDatabase
} from './databaseManager.js';

/**
 * PostgreSQL Proje Yönetim Servisi
 * Her proje için ayrı PostgreSQL database oluşturur
 */

/**
 * Yeni PostgreSQL projesi oluşturur
 */
export async function createProject(projectData) {
  let projectId = null;
  
  try {
    projectId = uuidv4();
    const projectName = projectData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    console.log(`🚀 Yeni PostgreSQL projesi oluşturuluyor: ${projectName}`);
    
    // PostgreSQL database oluştur
    const dbConfig = await createProjectDatabase(projectName);
    
    // Proje verisini hazırla
    const project = {
      id: projectId,
      name: projectName,
      description: projectData.description || '',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      
      // Database bağlantı bilgileri
      database_name: dbConfig.database,
      database_username: dbConfig.username,
      database_password: dbConfig.password,
      database_host: dbConfig.host,
      database_port: dbConfig.port,
      
      // Connection string
      connection_string: `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
      
      // Metadata
      owner_id: projectData.owner_id || 'system',
      tags: projectData.tags || [],
      environment: projectData.environment || 'development',
      table_count: 0,
      last_accessed: new Date().toISOString()
    };
    
    // Local database'e kaydet
    await dbCreateProject(project);
    
    // Log kaydı
    await logProjectAction(projectId, 'CREATE', 'SUCCESS', `PostgreSQL projesi oluşturuldu: ${projectName}`);
    
    console.log(`✅ PostgreSQL projesi oluşturuldu: ${projectName} (${projectId})`);
    return project;
    
  } catch (error) {
    console.error('❌ Proje oluşturma hatası:', error);
    
    // Hata durumunda cleanup
    if (projectId) {
      await logProjectAction(projectId, 'CREATE', 'ERROR', error.message);
    }
    
    throw error;
  }
}

/**
 * Projeyi başlatır
 */
export async function startProject(projectId) {
  try {
    const project = await findProject(projectId);
    
    if (!project) {
      throw new Error('Proje bulunamadı');
    }
    
    if (project.status === 'running') {
      throw new Error('Proje zaten çalışıyor');
    }
    
    console.log(`🔄 Proje başlatılıyor: ${project.name}`);
    
    // Proje klasörüne git ve Supabase'i başlat
    const startCommand = `cd "${project.project_path}" && supabase start`;
    
    return new Promise((resolve, reject) => {
      const process = spawn('bash', ['-c', startCommand], {
        stdio: 'pipe',
        detached: false
      });
      
      let output = '';
      let errorOutput = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      process.on('close', async (code) => {
        if (code === 0) {
          // Başarılı başlatma
          await updateProject(projectId, {
            status: 'running',
            updated_at: new Date().toISOString()
          });
          
          await logProjectAction(projectId, 'START', 'SUCCESS', 'Proje başlatıldı');
          
          console.log(`✅ Proje başlatıldı: ${project.name}`);
          resolve({
            message: 'Proje başarıyla başlatıldı',
            project: { ...project, status: 'running' },
            output
          });
        } else {
          await logProjectAction(projectId, 'START', 'ERROR', errorOutput);
          reject(new Error(`Proje başlatma hatası: ${errorOutput}`));
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Proje başlatma hatası:', error);
    await logProjectAction(projectId, 'START', 'ERROR', error.message);
    throw error;
  }
}

/**
 * Projeyi durdurur
 */
export async function stopProject(projectId) {
  try {
    const project = await findProject(projectId);
    
    if (!project) {
      throw new Error('Proje bulunamadı');
    }
    
    if (project.status === 'stopped') {
      throw new Error('Proje zaten durdurulmuş');
    }
    
    console.log(`⏹️  Proje durduruluyor: ${project.name}`);
    
    // Proje klasörüne git ve Supabase'i durdur
    const stopCommand = `cd "${project.project_path}" && supabase stop`;
    
    execSync(stopCommand, { stdio: 'pipe' });
    
    // Database'de durumu güncelle
    await updateProject(projectId, {
      status: 'stopped',
      updated_at: new Date().toISOString()
    });
    
    await logProjectAction(projectId, 'STOP', 'SUCCESS', 'Proje durduruldu');
    
    console.log(`✅ Proje durduruldu: ${project.name}`);
    return { message: 'Proje başarıyla durduruldu' };
    
  } catch (error) {
    console.error('❌ Proje durdurma hatası:', error);
    await logProjectAction(projectId, 'STOP', 'ERROR', error.message);
    throw error;
  }
}

/**
 * Projeyi siler
 */
export async function deleteProject(projectId) {
  try {
    const project = await findProject(projectId);
    
    if (!project) {
      throw new Error('Proje bulunamadı');
    }
    
    console.log(`🗑️  PostgreSQL projesi siliniyor: ${project.name}`);
    
    // PostgreSQL database'i sil
    await dropProjectDatabase(project.database_name, project.database_username);
    
    // Local database'den sil
    await dbDeleteProject(projectId);
    
    await logProjectAction(projectId, 'DELETE', 'SUCCESS', 'PostgreSQL projesi silindi');
    
    console.log(`✅ PostgreSQL projesi silindi: ${project.name}`);
    return { message: 'Proje başarıyla silindi' };
    
  } catch (error) {
    console.error('❌ Proje silme hatası:', error);
    await logProjectAction(projectId, 'DELETE', 'ERROR', error.message);
    throw error;
  }
}

/**
 * Tüm projeleri listeler
 */
export async function listProjects(filters = {}) {
  try {
    return await dbListProjects(filters);
  } catch (error) {
    console.error('❌ Proje listesi hatası:', error);
    throw error;
  }
}

/**
 * Proje bilgilerini günceller
 */
export async function updateProjectInfo(projectId, updates) {
  try {
    const updatedProject = await updateProject(projectId, {
      ...updates,
      updated_at: new Date().toISOString()
    });
    
    if (!updatedProject) {
      throw new Error('Proje bulunamadı');
    }
    
    await logProjectAction(projectId, 'UPDATE', 'SUCCESS', 'Proje bilgileri güncellendi');
    
    return updatedProject;
  } catch (error) {
    console.error('❌ Proje güncelleme hatası:', error);
    await logProjectAction(projectId, 'UPDATE', 'ERROR', error.message);
    throw error;
  }
}

/**
 * Proje istatistiklerini günceller
 */
export async function updateProjectStats(projectId, stats) {
  try {
    await updateProject(projectId, {
      table_count: stats.table_count || 0,
      last_accessed: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Proje istatistik güncelleme hatası:', error);
  }
}

/**
 * Proje için database config döndürür
 */
export function getProjectDbConfig(project) {
  return {
    host: project.database_host,
    port: project.database_port,
    database: project.database_name,
    username: project.database_username,
    password: project.database_password
  };
}

/**
 * Proje erişim bilgilerini validation yapar
 */
export function validateProjectAccess(project, providedPassword) {
  if (!project) {
    throw new Error('Proje bulunamadı');
  }
  
  if (project.database_password !== providedPassword) {
    throw new Error('Geçersiz database şifresi');
  }
  
  // Son erişim zamanını güncelle
  updateProjectStats(project.id, {});
  
  return true;
}

/**
 * Proje işlemlerini loglar
 */
async function logProjectAction(projectId, action, status, message, errorDetails = null) {
  try {
    await addLog({
      project_id: projectId,
      action,
      status,
      message,
      error_details: errorDetails
    });
  } catch (error) {
    console.error('Log kaydetme hatası:', error);
  }
} 