import pg from 'pg';
import crypto from 'crypto';
const { Pool } = pg;

/**
 * PostgreSQL Database Manager
 * Her proje için ayrı database oluşturur ve yönetir
 */

// Ana PostgreSQL bağlantısı (postgres database)
let masterPool = null;

// Proje database bağlantıları cache
const projectPools = new Map();

// Master PostgreSQL ayarları
const MASTER_CONFIG = {
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres', // Master database
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

/**
 * Master PostgreSQL bağlantısını başlatır
 */
export async function initMasterConnection() {
  try {
    masterPool = new Pool(MASTER_CONFIG);
    
    // Bağlantıyı test et
    const client = await masterPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    console.log('✅ Master PostgreSQL bağlantısı başarılı');
    return masterPool;
  } catch (error) {
    console.error('❌ Master PostgreSQL bağlantı hatası:', error);
    throw error;
  }
}

/**
 * Yeni proje database'i oluşturur
 */
export async function createProjectDatabase(projectName) {
  try {
    // Database adını temizle (PostgreSQL uyumlu)
    const dbName = projectName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const username = `${dbName}_user`;
    const password = generateSecurePassword();
    
    const client = await masterPool.connect();
    
    try {
      // Database'in var olup olmadığını kontrol et
      const existsQuery = `
        SELECT 1 FROM pg_database WHERE datname = $1
      `;
      const existsResult = await client.query(existsQuery, [dbName]);
      
      if (existsResult.rows.length > 0) {
        throw new Error(`Database '${dbName}' zaten mevcut`);
      }
      
      // Yeni database oluştur
      await client.query(`CREATE DATABASE "${dbName}"`);
      
      // Kullanıcı oluştur (proje için özel)
      await client.query(`
        CREATE USER "${username}" WITH PASSWORD '${password}'
      `);
      
      // Kullanıcıya database üzerinde tam yetki ver
      await client.query(`
        GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${username}"
      `);
      
      console.log(`✅ Database oluşturuldu: ${dbName}`);
      
    } finally {
      client.release();
    }
    
    // Şimdi postgres superuser ile yeni database'e bağlanıp schema izinlerini ver
    const dbPool = new Pool({
      host: MASTER_CONFIG.host,
      port: MASTER_CONFIG.port,
      user: MASTER_CONFIG.user,        // postgres superuser
      password: MASTER_CONFIG.password, // postgres password
      database: dbName,                 // yeni database
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    const dbClient = await dbPool.connect();
    
    try {
      // Public schema'nın sahibini yeni kullanıcı yap
      await dbClient.query(`
        ALTER SCHEMA public OWNER TO "${username}"
      `);
      
      // Public schema izinlerini ver
      await dbClient.query(`
        GRANT ALL ON SCHEMA public TO "${username}"
      `);
      
      await dbClient.query(`
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${username}"
      `);
      
      await dbClient.query(`
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${username}"
      `);
      
      await dbClient.query(`
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${username}"
      `);
      
      await dbClient.query(`
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${username}"
      `);
      
      // USAGE iznini de ver
      await dbClient.query(`
        GRANT USAGE ON SCHEMA public TO "${username}"
      `);
      
      // CREATE iznini ver
      await dbClient.query(`
        GRANT CREATE ON SCHEMA public TO "${username}"
      `);
      
      console.log(`✅ Schema izinleri verildi: ${dbName}`);
      
    } finally {
      dbClient.release();
      await dbPool.end();
    }
    
    return {
      database: dbName,
      username: username,
      password: password,
      host: MASTER_CONFIG.host,
      port: MASTER_CONFIG.port
    };
    
  } catch (error) {
    console.error('❌ Database oluşturma hatası:', error);
    throw error;
  }
}

/**
 * Proje database'ine bağlantı pool'u oluşturur
 */
export async function getProjectPool(dbConfig) {
  const poolKey = `${dbConfig.database}_${dbConfig.username}`;
  
  if (projectPools.has(poolKey)) {
    return projectPools.get(poolKey);
  }
  
  try {
    const pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Bağlantıyı test et
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    projectPools.set(poolKey, pool);
    console.log(`✅ Proje pool oluşturuldu: ${dbConfig.database}`);
    
    return pool;
  } catch (error) {
    console.error('❌ Proje pool oluşturma hatası:', error);
    throw error;
  }
}

/**
 * Tablo oluşturur
 */
export async function createTable(dbConfig, tableName, columns) {
  try {
    const pool = await getProjectPool(dbConfig);
    const client = await pool.connect();
    
    try {
      // Kolon tanımlarını oluştur
      const columnDefs = columns.map(col => {
        let def = `"${col.name}" ${col.type}`;
        
        if (col.nullable === false) def += ' NOT NULL';
        if (col.primary_key) def += ' PRIMARY KEY';
        if (col.unique) def += ' UNIQUE';
        if (col.default !== undefined) def += ` DEFAULT ${col.default}`;
        
        return def;
      }).join(', ');
      
      const createQuery = `
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          ${columnDefs}
        )
      `;
      
      await client.query(createQuery);
      console.log(`✅ Tablo oluşturuldu: ${tableName}`);
      
      return { success: true, table: tableName };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Tablo oluşturma hatası:', error);
    throw error;
  }
}

/**
 * Tabloları listeler
 */
export async function listTables(dbConfig) {
  try {
    const pool = await getProjectPool(dbConfig);
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          table_name,
          table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Tablo listeleme hatası:', error);
    throw error;
  }
}

/**
 * Tablo yapısını getirir
 */
export async function getTableSchema(dbConfig, tableName) {
  try {
    const pool = await getProjectPool(dbConfig);
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `;
      
      const result = await client.query(query, [tableName]);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Tablo şeması getirme hatası:', error);
    throw error;
  }
}

/**
 * SQL sorgusu çalıştırır
 */
export async function executeQuery(dbConfig, sqlQuery, params = []) {
  try {
    const pool = await getProjectPool(dbConfig);
    const client = await pool.connect();
    
    try {
      // Güvenlik kontrolü - tehlikeli komutları engelle
      const dangerousCommands = ['DROP', 'DELETE FROM', 'TRUNCATE', 'ALTER'];
      const upperQuery = sqlQuery.toUpperCase().trim();
      
      const isDangerous = dangerousCommands.some(cmd => 
        upperQuery.startsWith(cmd)
      );
      
      if (isDangerous) {
        throw new Error('Tehlikeli SQL komutu tespit edildi. Bu işlem izin verilmiyor.');
      }
      
      const result = await client.query(sqlQuery, params);
      
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command,
        fields: result.fields?.map(f => ({
          name: f.name,
          dataTypeID: f.dataTypeID
        }))
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ SQL sorgu hatası:', error);
    throw error;
  }
}

/**
 * CRUD İşlemleri
 */

// INSERT
export async function insertRecord(dbConfig, tableName, data) {
  try {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await executeQuery(dbConfig, query, values);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Insert hatası:', error);
    throw error;
  }
}

// SELECT
export async function selectRecords(dbConfig, tableName, conditions = {}, options = {}) {
  try {
    let query = `SELECT * FROM "${tableName}"`;
    const params = [];
    
    // WHERE koşulları
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions).map((key, i) => {
        params.push(conditions[key]);
        return `"${key}" = $${i + 1}`;
      }).join(' AND ');
      
      query += ` WHERE ${whereClause}`;
    }
    
    // ORDER BY
    if (options.orderBy) {
      query += ` ORDER BY "${options.orderBy}"`;
      if (options.orderDirection) {
        query += ` ${options.orderDirection}`;
      }
    }
    
    // LIMIT
    if (options.limit) {
      query += ` LIMIT ${parseInt(options.limit)}`;
    }
    
    // OFFSET
    if (options.offset) {
      query += ` OFFSET ${parseInt(options.offset)}`;
    }
    
    const result = await executeQuery(dbConfig, query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Select hatası:', error);
    throw error;
  }
}

// UPDATE
export async function updateRecord(dbConfig, tableName, id, data) {
  try {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = columns.map((col, i) => 
      `"${col}" = $${i + 1}`
    ).join(', ');
    
    const query = `
      UPDATE "${tableName}" 
      SET ${setClause}
      WHERE id = $${columns.length + 1}
      RETURNING *
    `;
    
    const result = await executeQuery(dbConfig, query, [...values, id]);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Update hatası:', error);
    throw error;
  }
}

// DELETE
export async function deleteRecord(dbConfig, tableName, id) {
  try {
    const query = `
      DELETE FROM "${tableName}" 
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await executeQuery(dbConfig, query, [id]);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Delete hatası:', error);
    throw error;
  }
}

/**
 * Database'i siler
 */
export async function dropProjectDatabase(dbName, username) {
  try {
    const client = await masterPool.connect();
    
    try {
      // Önce active bağlantıları kes
      await client.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [dbName]);
      
      // Database'i sil
      await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      
      // Kullanıcıyı sil
      await client.query(`DROP USER IF EXISTS "${username}"`);
      
      // Pool cache'ten kaldır
      const poolKey = `${dbName}_${username}`;
      if (projectPools.has(poolKey)) {
        const pool = projectPools.get(poolKey);
        await pool.end();
        projectPools.delete(poolKey);
      }
      
      console.log(`✅ Database silindi: ${dbName}`);
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Database silme hatası:', error);
    throw error;
  }
}

/**
 * Güvenli şifre üretir
 */
function generateSecurePassword() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Master bağlantıyı kapatır
 */
export async function closeMasterConnection() {
  try {
    if (masterPool) {
      await masterPool.end();
      masterPool = null;
    }
    
    // Tüm proje pool'larını kapat
    for (const [key, pool] of projectPools) {
      await pool.end();
      projectPools.delete(key);
    }
    
    console.log('✅ Tüm database bağlantıları kapatıldı');
  } catch (error) {
    console.error('❌ Bağlantı kapatma hatası:', error);
  }
}

// Process sonlandığında bağlantıları kapat
process.on('exit', closeMasterConnection);
process.on('SIGINT', closeMasterConnection);
process.on('SIGTERM', closeMasterConnection); 