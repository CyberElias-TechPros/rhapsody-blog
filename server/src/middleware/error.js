export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` } });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.code || (status === 500 ? 'INTERNAL' : 'ERROR'),
      message: err.message || 'Something went wrong',
      details: err.details,
    },
  });
};
