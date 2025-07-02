#!/bin/bash

# Supabase Template Temizleme Script'i
# Bu script ile projeyi tamamen temizleyebilirsin

echo "🧹 Supabase Template Temizleniyor..."

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Kullanıcıdan onay al
echo -e "${YELLOW}⚠️  Bu işlem şunları silecek:${NC}"
echo "   • Tüm Docker container'ları"
echo "   • Tüm veri tabanı verilerini"
echo "   • Supabase volume'larını"
echo ""
read -p "Devam etmek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}İşlem iptal edildi.${NC}"
    exit 1
fi

# Supabase'i durdur
echo -e "${BLUE}🔄 Supabase durduruluyor...${NC}"
supabase stop --no-backup

# Docker container'ları temizle
echo -e "${BLUE}🔄 Docker container'ları temizleniyor...${NC}"
docker container prune -f

# Docker volume'ları temizle
echo -e "${BLUE}🔄 Docker volume'ları temizleniyor...${NC}"
docker volume prune -f

# Supabase temp dosyalarını temizle
echo -e "${BLUE}🔄 Temp dosyalar temizleniyor...${NC}"
if [ -d "supabase/.temp" ]; then
    rm -rf supabase/.temp/*
fi

# Başarı mesajı
echo -e "${GREEN}"
echo "✅ Temizleme tamamlandı!"
echo ""
echo "🔄 Yeniden başlatmak için:"
echo "   ./start.sh"
echo -e "${NC}" 