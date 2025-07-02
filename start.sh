#!/bin/bash

# Supabase Template Başlatma Script'i
# Bu script ile projeyi hızlıca başlatabilirsin

echo "🚀 Supabase Template Başlatılıyor..."

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Supabase CLI kontrol
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI bulunamadı!${NC}"
    echo -e "${YELLOW}Kurulum için: brew install supabase/tap/supabase${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI mevcut${NC}"

# Docker kontrol
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker bulunamadı!${NC}"
    echo -e "${YELLOW}Docker Desktop'ı indirip kurun: https://www.docker.com/products/docker-desktop${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker mevcut${NC}"

# Docker çalışıyor mu kontrol
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker çalışmıyor!${NC}"
    echo -e "${YELLOW}Docker Desktop'ı başlatın${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker çalışıyor${NC}"

# Environment dosyası oluştur
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 .env dosyası oluşturuluyor...${NC}"
    cp env.example .env
    echo -e "${GREEN}✅ .env dosyası oluşturuldu${NC}"
else
    echo -e "${GREEN}✅ .env dosyası mevcut${NC}"
fi

# Supabase'i başlat
echo -e "${BLUE}🔄 Supabase başlatılıyor...${NC}"
supabase start

# Başarı mesajı
echo -e "${GREEN}"
echo "🎉 Başarılı! Supabase Template hazır!"
echo ""
echo "📱 Erişim Bilgileri:"
echo "   • Studio UI:  http://127.0.0.1:54323"
echo "   • API URL:    http://127.0.0.1:54321"
echo "   • Database:   postgresql://postgres:postgres@127.0.0.1:54322/postgres"
echo ""
echo "🛠️  Kullanışlı Komutlar:"
echo "   • supabase stop    # Supabase'i durdur"
echo "   • supabase status  # Durum kontrol"
echo "   • supabase logs    # Logları görüntüle"
echo -e "${NC}" 