# 🚀 PostgreSQL Project Manager API - Kullanım Kılavuzu

Bu API ile her proje için ayrı PostgreSQL database oluşturabilir ve yönetebilirsiniz.

## 📋 **Temel Bilgiler**

- **API URL**: `http://localhost:3000`
- **PostgreSQL**: `localhost:5433`
- **Authentication**: `X-Database-Password` header ile

## 🎯 **1. Yeni Proje Oluşturma**

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "blog-projesi",
    "description": "Blog uygulaması",
    "environment": "development",
    "tags": ["blog", "cms"]
  }'
```

**Response:**
```json
{
  "message": "PostgreSQL projesi başarıyla oluşturuldu",
  "project": {
    "id": "uuid-burada",
    "name": "blog-projesi",
    "database_name": "blog_projesi",
    "database_username": "blog_projesi_user",
    "database_password": "otomatik-sifre",
    "database_host": "localhost",
    "database_port": 5433,
    "connection_string": "postgresql://user:password@localhost:5433/dbname"
  }
}
```

> ⚠️ **Önemli**: `database_password`'ü kaydedin! Tüm database işlemlerinde gerekli.

---

## 📊 **2. Tablo Oluşturma**

```bash
curl -X POST http://localhost:3000/api/database/PROJECT_ID/tables \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: YOUR_DB_PASSWORD" \
  -d '{
    "tableName": "posts",
    "columns": [
      {
        "name": "id",
        "type": "SERIAL",
        "primary_key": true
      },
      {
        "name": "title",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "content",
        "type": "TEXT"
      },
      {
        "name": "published",
        "type": "BOOLEAN",
        "default": "false"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMP",
        "default": "NOW()"
      }
    ]
  }'
```

### Desteklenen Veri Tipleri:
- `SERIAL`, `INTEGER`, `BIGINT`, `SMALLINT`
- `VARCHAR`, `TEXT`, `CHAR`
- `BOOLEAN`
- `DATE`, `TIME`, `TIMESTAMP`
- `DECIMAL`, `NUMERIC`
- `JSON`, `JSONB`

---

## ➕ **3. Kayıt Ekleme**

```bash
curl -X POST http://localhost:3000/api/database/PROJECT_ID/tables/posts/records \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: YOUR_DB_PASSWORD" \
  -d '{
    "data": {
      "title": "İlk Blog Yazım",
      "content": "Bu benim ilk blog yazım. PostgreSQL Project Manager harika!",
      "published": true
    }
  }'
```

---

## 🔍 **4. Kayıtları Sorgulama**

### Tüm kayıtları getir:
```bash
curl -X GET "http://localhost:3000/api/database/PROJECT_ID/tables/posts/records" \
  -H "X-Database-Password: YOUR_DB_PASSWORD"
```

### Filtreleme ve sıralama:
```bash
curl -X GET "http://localhost:3000/api/database/PROJECT_ID/tables/posts/records?published=true&limit=10&orderBy=created_at&orderDirection=DESC" \
  -H "X-Database-Password: YOUR_DB_PASSWORD"
```

---

## ✏️ **5. Kayıt Güncelleme**

```bash
curl -X PUT http://localhost:3000/api/database/PROJECT_ID/tables/posts/records/1 \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: YOUR_DB_PASSWORD" \
  -d '{
    "data": {
      "title": "Güncellenmiş Başlık",
      "published": true
    }
  }'
```

---

## 🗑️ **6. Kayıt Silme**

```bash
curl -X DELETE http://localhost:3000/api/database/PROJECT_ID/tables/posts/records/1 \
  -H "X-Database-Password: YOUR_DB_PASSWORD"
```

---

## 💻 **7. Custom SQL Çalıştırma**

```bash
curl -X POST http://localhost:3000/api/database/PROJECT_ID/query \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: YOUR_DB_PASSWORD" \
  -d '{
    "sql": "SELECT id, title, created_at FROM posts WHERE published = $1 ORDER BY created_at DESC",
    "params": [true]
  }'
```

### Güvenlik Kısıtlamaları:
- `DROP`, `DELETE FROM`, `TRUNCATE`, `ALTER` komutları engellenir
- Parameterized queries kullanın ($1, $2, ...)

---

## 📋 **8. Yardımcı Komutlar**

### Tabloları listele:
```bash
curl -X GET http://localhost:3000/api/database/PROJECT_ID/tables \
  -H "X-Database-Password: YOUR_DB_PASSWORD"
```

### Tablo şemasını görüntüle:
```bash
curl -X GET http://localhost:3000/api/database/PROJECT_ID/tables/posts/schema \
  -H "X-Database-Password: YOUR_DB_PASSWORD"
```

### Projeleri listele:
```bash
curl -X GET http://localhost:3000/api/projects
```

### Proje detayları:
```bash
curl -X GET http://localhost:3000/api/projects/PROJECT_ID
```

---

## 🗂️ **9. Tam Örnek Workflow**

```bash
# 1. Proje oluştur
PROJECT=$(curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "ecommerce", "description": "E-ticaret sitesi"}')

# ID ve şifreyi çıkar
PROJECT_ID=$(echo $PROJECT | jq -r '.project.id')
DB_PASSWORD=$(echo $PROJECT | jq -r '.project.database_password')

echo "Proje ID: $PROJECT_ID"
echo "DB Şifre: $DB_PASSWORD"

# 2. Users tablosu oluştur
curl -X POST http://localhost:3000/api/database/$PROJECT_ID/tables \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: $DB_PASSWORD" \
  -d '{
    "tableName": "users",
    "columns": [
      {"name": "id", "type": "SERIAL", "primary_key": true},
      {"name": "email", "type": "VARCHAR", "nullable": false, "unique": true},
      {"name": "name", "type": "VARCHAR", "nullable": false},
      {"name": "created_at", "type": "TIMESTAMP", "default": "NOW()"}
    ]
  }'

# 3. Kullanıcı ekle
curl -X POST http://localhost:3000/api/database/$PROJECT_ID/tables/users/records \
  -H "Content-Type: application/json" \
  -H "X-Database-Password: $DB_PASSWORD" \
  -d '{
    "data": {
      "email": "admin@example.com",
      "name": "Admin User"
    }
  }'

# 4. Kullanıcıları listele
curl -X GET http://localhost:3000/api/database/$PROJECT_ID/tables/users/records \
  -H "X-Database-Password: $DB_PASSWORD"
```

---

## ❌ **10. Proje Silme**

```bash
curl -X DELETE http://localhost:3000/api/projects/PROJECT_ID
```

> ⚠️ **Dikkat**: Bu işlem proje ve tüm verilerini kalıcı olarak siler!

---

## 📊 **11. İstatistikler**

### Sistem durumu:
```bash
curl http://localhost:3000/health
```

### Proje istatistikleri:
```bash
curl http://localhost:3000/api/projects/stats/overview
```

---

## 🔧 **12. Hata Kodları**

- **400**: Geçersiz veri formatı
- **401**: Yanlış database şifresi
- **404**: Proje/kayıt bulunamadı
- **429**: Çok fazla istek (rate limit)
- **500**: Sunucu hatası

---

## 💡 **İpuçları**

1. **Database şifresini kaydedin** - Her işlemde gerekli
2. **Parameterized queries kullanın** - SQL injection koruması
3. **Rate limit'e dikkat** - 15 dakikada max 100 request
4. **Backup alın** - Önemli veriler için
5. **Environment'leri ayırın** - development/staging/production

---

## 🚀 **Hızlı Test**

```bash
# PostgreSQL çalışıyor mu?
docker ps | grep postgres

# API çalışıyor mu?
curl http://localhost:3000/health

# Yeni proje oluştur ve test et
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "description": "Test projesi"}'
```

Bu kadar! 🎉 Artık PostgreSQL Project Manager API'yi kullanmaya hazırsınız! 