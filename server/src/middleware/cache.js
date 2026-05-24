const cache = new Map();

// Her 5 dakikada bir süresi geçmiş önbellekleri temizle (Memory leak'i önlemek için)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expiry) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const clearUserCache = (userId) => {
  const prefix = `${userId}-`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};

export const cacheMiddleware = (durationSeconds = 60) => {
  return (req, res, next) => {
    // Sadece GET isteklerini önbelleğe al
    if (req.method !== 'GET') {
      return next();
    }

    // Kullanıcıya ve URL'ye özel benzersiz bir anahtar (key) oluştur
    const userId = req.user?.id || 'anonymous';
    const key = `${userId}-${req.originalUrl}`;
    const now = Date.now();

    // Önbellekte varsa ve henüz süresi dolmadıysa direkt oradan dön
    const cachedData = cache.get(key);
    if (cachedData && now < cachedData.expiry) {
      console.log(`⚡ Cache HIT: ${key}`);
      return res.json(cachedData.body);
    }

    console.log(`🐢 Cache MISS: ${key}`);
    
    // res.json metodunu araya girerek (intercept) gelen yanıtı yakala ve kaydet
    const originalJson = res.json;
    res.json = function (body) {
      if (res.statusCode === 200) {
        cache.set(key, {
          body,
          expiry: Date.now() + (durationSeconds * 1000)
        });
      }
      // Orijinal res.json'u çağırıp yanıtı istemciye gönder
      originalJson.call(this, body);
    };

    next();
  };
};

export const invalidateCacheMiddleware = (req, res, next) => {
  // Veri değiştiren isteklerde (POST, PUT, DELETE) kullanıcının önbelleğini temizle
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const userId = req.user?.id;
    if (userId) {
      clearUserCache(userId);
      console.log(`🧹 Cache CLEARED for user: ${userId} due to ${req.method} request on ${req.originalUrl}`);
    }
  }
  next();
};
