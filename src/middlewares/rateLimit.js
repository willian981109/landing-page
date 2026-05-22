function createRateLimit({ windowMs, max, keyPrefix = "rate" }) {
  const attempts = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const current = attempts.get(key);

    if (!current || current.expiresAt <= now) {
      attempts.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfterSeconds = Math.ceil((current.expiresAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));

      return res.status(429).json({
        error: "Muitas tentativas. Aguarde um pouco e tente novamente.",
        code: "RATE_LIMITED",
      });
    }

    attempts.set(key, current);
    return next();
  };
}

module.exports = createRateLimit;
