import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { Problem } from '@lokacia/contracts';

/** Throwable RFC 9457 problem with a stable type slug and Georgian title. */
export class ProblemException extends HttpException {
  constructor(status: number, slug: string, title: string, detail?: string, extra: Partial<Problem> = {}) {
    super({ type: `https://lokacia.ge/problems/${slug}`, title, status, detail, ...extra }, status);
  }
}

export const problems = {
  notFound: (what = 'რესურსი') => new ProblemException(404, 'not-found', `${what} ვერ მოიძებნა`),
  forbidden: (detail?: string) => new ProblemException(403, 'forbidden', 'წვდომა აკრძალულია', detail),
  unauthorized: () => new ProblemException(401, 'unauthorized', 'გთხოვთ, შეხვიდეთ სისტემაში'),
  conflict: (detail: string) => new ProblemException(409, 'conflict', 'კონფლიქტი', detail),
  badRequest: (detail: string) => new ProblemException(400, 'bad-request', 'არასწორი მოთხოვნა', detail),
  tooMany: (detail = 'ძალიან ბევრი მოთხოვნა. სცადეთ მოგვიანებით.') => new ProblemException(429, 'rate-limited', 'ლიმიტი გადაჭარბებულია', detail),
  invalidTransition: (from: string, to: string) => new ProblemException(422, 'invalid-transition', 'სტატუსის ცვლა შეუძლებელია', `${from} → ${to}`),
};

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    if (!res || typeof res.status !== 'function') return; // non-HTTP context (ws)

    let body: Problem;
    if (exception instanceof ZodError) {
      body = {
        type: 'https://lokacia.ge/problems/validation',
        title: 'შეყვანილი მონაცემები არასწორია',
        status: 422,
        errors: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
    } else if (exception instanceof HttpException) {
      const r = exception.getResponse();
      const status = exception.getStatus();
      body =
        typeof r === 'object' && r && 'type' in r
          ? (r as Problem)
          : {
              type: `https://lokacia.ge/problems/http-${status}`,
              title: typeof r === 'string' ? r : ((r as { message?: string }).message?.toString() ?? exception.message),
              status,
            };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      body = { type: 'https://lokacia.ge/problems/internal', title: 'სერვერის შეცდომა', status: HttpStatus.INTERNAL_SERVER_ERROR };
    }
    body.instance = req.originalUrl;
    res.status(body.status).type('application/problem+json').json(body);
  }
}
