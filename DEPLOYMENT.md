# 🚀 Sunucu Deployment Kılavuzu

PostgreSQL Project Manager API'yi kendi sunucunuzda çalıştırma rehberi.

## 📋 **Sunucu Gereksinimleri**

- **İşletim Sistemi**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **RAM**: Minimum 2GB (4GB önerilen)
- **Disk**: 20GB+ (database'ler için)
- **CPU**: 2 Core minimum
- **Node.js**: 18.0+
- **Docker**: Latest version

---

## 🔧 **1. Sunucu Hazırlığı**

### Ubuntu/Debian için:
```bash
# Sistem güncellemesi
sudo apt update && sudo apt upgrade -y

# Node.js kurulumu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker kurulumu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose kurulumu
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git kurulumu
sudo apt install git -y

# PM2 kurulumu (process manager)
sudo npm install -g pm2

# Firewall ayarları
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000  # API portu
sudo ufw allow 5433  # PostgreSQL portu (opsiyonel)
```

### CentOS/RHEL için:
```bash
# Sistem güncellemesi
sudo yum update -y

# Node.js kurulumu
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Docker kurulumu
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Docker Compose kurulumu
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git ve PM2
sudo yum install -y git
sudo npm install -g pm2

# Firewall ayarları
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=5433/tcp
sudo firewall-cmd --reload
```

---

## 📁 **2. Proje Dosyalarını Kopyalama**

### Local'den sunucuya kopyalama:
```bash
# Sunucuda proje klasörü oluştur
ssh user@your-server.com
mkdir -p /opt/psql-api
cd /opt/psql-api

# Local'den dosyaları kopyala (local bilgisayarınızdan)
rsync -avz --exclude node_modules --exclude .git --exclude logs --exclude database /path/to/local/psql-api/ user@your-server.com:/opt/psql-api/

# Veya Git ile
git clone https://github.com/your-username/psql-api.git /opt/psql-api
cd /opt/psql-api
```

### Dosya sahipliği:
```bash
# Dosya sahipliğini ayarla
sudo chown -R $USER:$USER /opt/psql-api
chmod +x /opt/psql-api/start.sh
```

---

## ⚙️ **3. Environment Ayarları**

### Production .env dosyası:
```bash
cat > /opt/psql-api/.env << EOF
# Production Environment
NODE_ENV=production
PORT=3000

# API Settings
CORS_ORIGIN=https://yourdomain.com
API_BASE_URL=https://yourdomain.com

# PostgreSQL Settings
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-super-secure-password

# Security
JWT_SECRET=your-256-bit-secret-key-here
API_KEY=your-api-key-for-admin-access

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/psql-api/combined.log

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=200        # requests per window

# SSL (eğer kullanıyorsanız)
SSL_CERT_PATH=/etc/ssl/certs/your-cert.pem
SSL_KEY_PATH=/etc/ssl/private/your-key.pem
EOF
```

### Log klasörü oluştur:
```bash
sudo mkdir -p /var/log/psql-api
sudo chown $USER:$USER /var/log/psql-api
```

---

## 🐳 **4. Docker Konfigürasyonu**

### Production docker-compose.yml:
```bash
cat > /opt/psql-api/docker-compose.prod.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: postgres-project-manager-prod
    restart: always
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-your-super-secure-password}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
      POSTGRES_HOST_AUTH_METHOD: scram-sha-256
    ports:
      - "127.0.0.1:5433:5432"  # Sadece localhost'tan erişim
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
      - ./backups:/backups  # Backup klasörü
    networks:
      - psql-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Redis cache (opsiyonel)
  redis:
    image: redis:7-alpine
    container_name: redis-project-manager
    restart: always
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - psql-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  psql-network:
    driver: bridge
EOF
```

---

## 🚀 **5. Uygulama Başlatma**

### Dependencies yükle:
```bash
cd /opt/psql-api
npm ci --production
```

### PostgreSQL başlat:
```bash
docker-compose -f docker-compose.prod.yml up -d postgres
```

### PM2 ile API başlat:
```bash
# PM2 ecosystem dosyası oluştur
cat > /opt/psql-api/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'psql-api',
    script: './server.js',
    instances: 'max',  // CPU core sayısına göre
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/psql-api/combined.log',
    out_file: '/var/log/psql-api/out.log',
    error_file: '/var/log/psql-api/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# API'yi başlat
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## 🌐 **6. Nginx Reverse Proxy**

### Nginx kurulumu:
```bash
sudo apt install nginx -y  # Ubuntu/Debian
# sudo yum install nginx -y  # CentOS/RHEL
```

### Nginx konfigürasyonu:
```bash
sudo cat > /etc/nginx/sites-available/psql-api << EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:3000/health;
    }

    # Static files (opsiyonel)
    location /static/ {
        alias /opt/psql-api/public/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Site'ı aktifleştir
sudo ln -s /etc/nginx/sites-available/psql-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 🔒 **7. SSL Sertifikası (Let's Encrypt)**

```bash
# Certbot kurulumu
sudo apt install certbot python3-certbot-nginx -y

# SSL sertifikası al
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Otomatik yenileme
sudo crontab -e
# Şu satırı ekleyin:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 📊 **8. Monitoring ve Backup**

### Log monitoring:
```bash
# PM2 monitoring
pm2 monit

# Log takibi
pm2 logs psql-api --lines 100

# Sistem logları
tail -f /var/log/psql-api/combined.log
```

### Backup scripti:
```bash
cat > /opt/psql-api/backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/opt/psql-api/backups"
DATE=\$(date +%Y%m%d_%H%M%S)

# Database backup
docker exec postgres-project-manager-prod pg_dumpall -U postgres > \$BACKUP_DIR/backup_\$DATE.sql

# Project files backup
tar -czf \$BACKUP_DIR/files_\$DATE.tar.gz /opt/psql-api --exclude=/opt/psql-api/backups --exclude=/opt/psql-api/node_modules

# Eski backupları sil (30 günden eski)
find \$BACKUP_DIR -name "*.sql" -mtime +30 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: \$DATE"
EOF

chmod +x /opt/psql-api/backup.sh

# Günlük backup cronjob
sudo crontab -e
# Şu satırı ekleyin:
# 0 2 * * * /opt/psql-api/backup.sh >> /var/log/psql-api/backup.log 2>&1
```

---

## 🛡️ **9. Güvenlik Sertleştirme**

### Sistem güvenliği:
```bash
# Fail2ban kurulumu
sudo apt install fail2ban -y

# Fail2ban konfigürasyonu
sudo cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true
EOF

sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

### PostgreSQL güvenliği:
```bash
# PostgreSQL konfigürasyonu güncelle
docker exec -it postgres-project-manager-prod psql -U postgres -c "ALTER USER postgres PASSWORD 'your-new-super-secure-password';"
```

---

## 📱 **10. Test ve Doğrulama**

```bash
# API testi
curl https://yourdomain.com/health

# Proje oluşturma testi
curl -X POST https://yourdomain.com/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "production-test", "description": "Production test projesi"}'

# SSL testi
curl -I https://yourdomain.com

# Performance testi
ab -n 100 -c 10 https://yourdomain.com/health
```

---

## 🔄 **11. Güncelleme İşlemi**

```bash
#!/bin/bash
# update.sh
cd /opt/psql-api

# Backup al
./backup.sh

# Yeni kodu çek
git pull origin main

# Dependencies güncelle
npm ci --production

# PM2'yi yeniden başlat
pm2 reload psql-api

# Health check
sleep 5
curl -f http://localhost:3000/health || pm2 restart psql-api

echo "Update completed!"
```

---

## 🆘 **12. Sorun Giderme**

### Logları kontrol et:
```bash
# PM2 logları
pm2 logs psql-api

# Nginx logları
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logları
docker logs postgres-project-manager-prod

# Sistem logları
journalctl -u nginx
journalctl -f
```

### Yaygın sorunlar:
- **Port 3000 zaten kullanımda**: `sudo lsof -i :3000`
- **PostgreSQL bağlantı hatası**: Docker container durumunu kontrol et
- **SSL sertifika hatası**: Certbot loglarını kontrol et
- **Nginx 502 hatası**: PM2 process'ini kontrol et

---

## 🎉 **Tamamlandı!**

Artık PostgreSQL Project Manager API'niz production sunucusunda çalışıyor! 

**Erişim URL'leri:**
- API: `https://yourdomain.com`
- Health Check: `https://yourdomain.com/health`
- API Docs: `https://yourdomain.com/`

**Güvenlik Kontrol Listesi:**
- ✅ SSL sertifikası aktif
- ✅ Firewall ayarlandı
- ✅ Strong passwords kullanıldı
- ✅ Regular backup alınıyor
- ✅ Monitoring aktif
- ✅ Rate limiting uygulandı

---

**İpuçları:**
- Domain'inizi değiştirmeyi unutmayın!
- `.env` dosyasındaki şifreleri güçlü yapın
- Regular olarak güvenlik güncellemelerini uygulayın
- Backup'ları test edin 