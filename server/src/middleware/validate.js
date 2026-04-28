import { HttpError } from './error.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(new HttpError(400, 'Validation failed', result.error.flatten()));
  }
  req[source] = result.data;
  next();
};
