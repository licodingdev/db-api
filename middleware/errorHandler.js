/**
 * Global Error Handler Middleware
 * Tüm hatları yakalar ve uygun HTTP yanıtları döndürür
 */

export function errorHandler(err, req, res, next) {
  // Log the error
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Default error
  let status = 500;
  let message = 'Sunucu hatası oluştu';
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Geçersiz veri';
    details = err.message;
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Geçersiz ID formatı';
  } else if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    status = 409;
    message = 'Bu isimde bir proje zaten mevcut';
  } else if (err.message.includes('Port bulunamadı')) {
    status = 503;
    message = 'Kullanılabilir port bulunamadı';
    details = err.message;
  } else if (err.message.includes('Proje bulunamadı')) {
    status = 404;
    message = 'Proje bulunamadı';
  } else if (err.message.includes('zaten çalışıyor')) {
    status = 409;
    message = err.message;
  } else if (err.message.includes('zaten durdurulmuş')) {
    status = 409;
    message = err.message;
  } else if (err.message.includes('Docker')) {
    status = 503;
    message = 'Docker servisi yanıt vermiyor';
    details = 'Docker Desktop\'ın çalıştığından emin olun';
  } else if (err.message.includes('Supabase CLI')) {
    status = 503;
    message = 'Supabase CLI yanıt vermiyor';
    details = 'Supabase CLI\'ın kurulu olduğundan emin olun';
  }

  // Development ortamında stack trace göster
  const response = {
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  if (details) {
    response.details = details;
  }

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
} 