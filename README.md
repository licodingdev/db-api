# 🐘 PostgreSQL Project Manager API

Her proje için ayrı PostgreSQL database oluşturan ve yöneten modern API servisi.

## ✨ Özellikler

- ✅ **Otomatik Database Oluşturma**: Her proje için izole PostgreSQL database
- ✅ **Güvenli Erişim**: Proje başına ayrı kullanıcı ve şifre
- ✅ **RESTful API**: Modern REST endpoint'leri
- ✅ **Tablo Yönetimi**: API ile tablo oluşturma, şema görüntüleme
- ✅ **CRUD İşlemleri**: Insert, Select, Update, Delete
- ✅ **SQL Executor**: Custom SQL sorguları çalıştırma
- ✅ **Validation**: Kapsamlı veri doğrulama
- ✅ **Logging**: Detaylı işlem logları
- ✅ **Docker Support**: Kolay kurulum ve çalıştırma

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js 18+
- Docker & Docker Compose
- Git

### Kurulum

```bash
# Repository'yi klonla
git clone <repo-url>
cd psql-api

# Dependencies yükle
npm install

# PostgreSQL'i başlat
docker-compose up -d

# API'yi başlat
npm start
```

### API Erişimi

- **API Base URL**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **pgAdmin**: http://localhost:8080 (admin@postgres-manager.com / admin123)

## 📚 API Kullanımı

### 1. Proje Oluşturma

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "e-ticaret-projesi",
    "description": "E-ticaret uygulaması database",
    "environment": "development",
    "tags": ["ecommerce", "web"]
  }'
```

**Response:**
```json
{
  "message": "PostgreSQL projesi başarıyla oluşturuldu",
  "project": {
    "id": "uuid-here",
    "name": "e-ticaret-projesi",
    "connection_string": "postgresql://username:password@localhost:5432/dbname",
    "database_name": "e_ticaret_projesi",
    "database_username": "e_ticaret_projesi_user",
    "database_password": "generated-password",
    "database_host": "localhost",
    "database_port": 5432
  }
}
```

### 2. Tablo Oluşturma

```bash
curl -X POST http://localhost:3000/api/database/{project-id}/tables \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: your-db-password" \
  -d '{
    "tableName": "users",
    "columns": [
      {
        "name": "id",
        "type": "SERIAL",
        "primary_key": true
      },
      {
        "name": "email",
        "type": "VARCHAR(255)",
        "nullable": false,
        "unique": true
      },
      {
        "name": "name",
        "type": "VARCHAR(100)",
        "nullable": false
      },
      {
        "name": "created_at",
        "type": "TIMESTAMP",
        "default": "NOW()"
      }
    ]
  }'
```

### 3. Kayıt Ekleme

```bash
curl -X POST http://localhost:3000/api/database/{project-id}/tables/users/records \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: your-db-password" \
  -d '{
    "data": {
      "email": "john@example.com",
      "name": "John Doe"
    }
  }'
```

### 4. Kayıtları Getirme

```bash
curl -X GET "http://localhost:3000/api/database/{project-id}/tables/users/records?limit=10&orderBy=created_at&orderDirection=DESC" \
  -H "X-Database-Password: your-db-password"
```

### 5. SQL Sorgusu Çalıştırma

```bash
curl -X POST http://localhost:3000/api/database/{project-id}/query \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: your-db-password" \
  -d '{
    "sql": "SELECT * FROM users WHERE email LIKE $1",
    "params": ["%@example.com"]
  }'
```

## 🔒 Güvenlik

### Authentication

Database işlemleri için **X-Database-Password** header'ı gereklidir:

```bash
-H "X-Database-Password: your-database-password"
```

Alternatif olarak request body'de `password` parametresi:

```json
{
  "password": "your-database-password",
  "sql": "SELECT * FROM users"
}
```

### Güvenlik Önlemleri

- ✅ SQL Injection koruması (parameterized queries)
- ✅ Tehlikeli SQL komutları engelleme (DROP, TRUNCATE, etc.)
- ✅ Rate limiting (15 dakikada 100 request)
- ✅ Request validation
- ✅ Proje izolasyonu (ayrı database + kullanıcı)

## 📋 API Endpoints

### Projeler

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/projects` | Yeni proje oluştur |
| GET | `/api/projects` | Projeleri listele |
| GET | `/api/projects/:id` | Proje detayları |
| DELETE | `/api/projects/:id` | Projeyi sil |
| GET | `/api/projects/:id/logs` | Proje logları |

### Database İşlemleri

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/database/:projectId/tables` | Tablo oluştur |
| GET | `/api/database/:projectId/tables` | Tabloları listele |
| GET | `/api/database/:projectId/tables/:table/schema` | Tablo şeması |
| POST | `/api/database/:projectId/query` | SQL sorgusu çalıştır |

### CRUD İşlemleri

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/database/:projectId/tables/:table/records` | Kayıt ekle |
| GET | `/api/database/:projectId/tables/:table/records` | Kayıtları getir |
| PUT | `/api/database/:projectId/tables/:table/records/:id` | Kayıt güncelle |
| DELETE | `/api/database/:projectId/tables/:table/records/:id` | Kayıt sil |

## 💾 Veri Tipleri

Desteklenen PostgreSQL veri tipleri:

- **Numerik**: `SERIAL`, `INTEGER`, `BIGINT`, `SMALLINT`, `DECIMAL`, `NUMERIC`, `REAL`, `DOUBLE PRECISION`
- **Metin**: `VARCHAR(n)`, `CHAR(n)`, `TEXT`
- **Boolean**: `BOOLEAN`
- **Tarih/Saat**: `DATE`, `TIME`, `TIMESTAMP`
- **JSON**: `JSON`, `JSONB`

## 📝 Örnek Kullanım Senaryosu

```bash
# 1. E-ticaret projesi oluştur
project_response=$(curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ecommerce-db",
    "description": "E-ticaret veritabanı",
    "environment": "development"
  }')

# Project ID ve password çıkar
project_id=$(echo $project_response | jq -r '.project.id')
db_password=$(echo $project_response | jq -r '.project.database_password')

# 2. Users tablosu oluştur
curl -X POST http://localhost:3000/api/database/$project_id/tables \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: $db_password" \
  -d '{
    "tableName": "users",
    "columns": [
      {"name": "id", "type": "SERIAL", "primary_key": true},
      {"name": "email", "type": "VARCHAR(255)", "nullable": false, "unique": true},
      {"name": "name", "type": "VARCHAR(100)", "nullable": false},
      {"name": "created_at", "type": "TIMESTAMP", "default": "NOW()"}
    ]
  }'

# 3. Products tablosu oluştur
curl -X POST http://localhost:3000/api/database/$project_id/tables \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: $db_password" \
  -d '{
    "tableName": "products",
    "columns": [
      {"name": "id", "type": "SERIAL", "primary_key": true},
      {"name": "name", "type": "VARCHAR(255)", "nullable": false},
      {"name": "price", "type": "DECIMAL(10,2)", "nullable": false},
      {"name": "stock", "type": "INTEGER", "default": "0"},
      {"name": "created_at", "type": "TIMESTAMP", "default": "NOW()"}
    ]
  }'

# 4. Test verisi ekle
curl -X POST http://localhost:3000/api/database/$project_id/tables/users/records \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: $db_password" \
  -d '{
    "data": {
      "email": "admin@ecommerce.com",
      "name": "Admin User"
    }
  }'

curl -X POST http://localhost:3000/api/database/$project_id/tables/products/records \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: $db_password" \
  -d '{
    "data": {
      "name": "Laptop",
      "price": 999.99,
      "stock": 10
    }
  }'

# 5. Verileri sorgula
curl -X GET http://localhost:3000/api/database/$project_id/tables/users/records \
  -H "X-Database-Password: $db_password"
```

## 🔧 Geliştirme

### Local Development

```bash
# Dev modda çalıştır (nodemon ile)
npm run dev

# Test çalıştır
npm test

# Linting
npm run lint
```

### Environment Variables

`.env` dosyası oluşturun:

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3000

# PostgreSQL Master Settings
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres

# Logging
LOG_LEVEL=info
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Proje İstatistikleri

```bash
curl http://localhost:3000/api/projects/stats/overview
```

## 🐳 Docker

### Production Build

```bash
# Image oluştur
docker build -t postgres-project-manager .

# Çalıştır
docker run -p 3000:3000 postgres-project-manager
```

### Docker Compose (Production)

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=postgres
    depends_on:
      - postgres
  
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## 🤝 Katkıda Bulunma

1. Fork'layın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit'leyin (`git commit -m 'Add amazing feature'`)
4. Push'layın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

MIT License - detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 📞 Destek

Sorularınız için:
- Issue açın: [GitHub Issues](https://github.com/your-repo/issues)
- E-posta: support@postgres-manager.com

---

**Made with ❤️ by Kurtuluş Cömert** 