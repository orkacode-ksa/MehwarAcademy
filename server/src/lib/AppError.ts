export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";
  }

  static notFound(message = "المورد غير موجود") {
    return new AppError(404, "RESOURCE_NOT_FOUND", message);
  }

  static badRequest(message = "طلب غير صالح") {
    return new AppError(400, "BAD_REQUEST", message);
  }

  static unauthorized(message = "غير مصرح") {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "ممنوع") {
    return new AppError(403, "FORBIDDEN", message);
  }

  static conflict(message = "تعارض في الحالة") {
    return new AppError(409, "CONFLICT", message);
  }

  static tooManyRequests(message = "طلبات كثيرة جدًا، حاول لاحقًا") {
    return new AppError(429, "TOO_MANY_REQUESTS", message);
  }
}
