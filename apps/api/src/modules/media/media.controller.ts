import { Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, SkipAudit } from '../../common/decorators';
import { problems } from '../../common/problem';
import type { AppRequest, AuthUser } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';
import { MEDIA_KINDS, MediaService } from './media.service';
import { placeholderSvg } from './placeholder';

const uploadSchema = z.object({ kind: z.enum(MEDIA_KINDS), contentType: z.string(), fileName: z.string().max(200), listingId: z.string().uuid().nullish(), size: z.number().int().positive().optional() });
const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(60) });
const updateSchema = z.object({ alt: z.string().max(200).optional(), isFloorplan: z.boolean().optional(), kind: z.enum(MEDIA_KINDS).optional() });
const enhanceSchema = z.object({ rotateDeg: z.number().min(-10).max(10).default(0) });

/** Served types. No SVG/HTML/XML: anything not listed is served as an attachment (stored XSS defence). */
const MIME: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', avif: 'image/avif', pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', glb: 'model/gltf-binary', m4a: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' };
const INLINE = /^(image|video|audio)\/|^application\/pdf$/;
/** Only user media lives under `uploads/`; contracts/, reports/, CRM imports etc. are private and served by their own guarded endpoints. */
const PUBLIC_KEY = /^uploads\/\d{4}-\d{2}\/[0-9a-f-]{36}\/[a-z0-9-]+\.[a-z0-9]{1,6}$/;

@ApiTags('media')
@Controller('v1/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Get('placeholder/:kind/:seed')
  @Header('content-type', 'image/svg+xml')
  @Header('cache-control', 'public, max-age=31536000, immutable')
  placeholder(@Param('kind') kind: string, @Param('seed') seed: string) {
    return placeholderSvg(kind, seed.replace(/\.svg$/, ''));
  }

  @Public()
  @Get('files/*path')
  async file(@Param('path') path: string | string[], @Res() res: Response) {
    const key = Array.isArray(path) ? path.join('/') : path;
    if (key.includes('..') || key.includes('\\') || key.includes('\0')) throw problems.badRequest('invalid path');
    if (!PUBLIC_KEY.test(key)) throw problems.notFound('ფაილი');
    const buf = await this.media.storage.get(key);
    if (!buf) throw problems.notFound('ფაილი');
    const type = MIME[key.split('.').pop() ?? ''] ?? 'application/octet-stream';
    res.setHeader('content-type', type);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('content-security-policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    if (!INLINE.test(type)) res.setHeader('content-disposition', 'attachment');
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    res.send(buf);
  }

  @Post('uploads')
  @ApiZodBody(uploadSchema)
  @SkipAudit()
  create(@CurrentUser() user: AuthUser, @ZBody(uploadSchema) body: z.infer<typeof uploadSchema>) {
    return this.media.createUpload(user, body);
  }

  /** Local storage upload target (S3 driver uploads directly to the bucket). */
  @Public()
  @Put('uploads/:key')
  @SkipAudit()
  async put(@Param('key') key: string, @Query('token') token: string, @Req() req: AppRequest) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) throw problems.badRequest('ფაილი 25 მბ-ზე დიდია');
      chunks.push(chunk);
    }
    const body = chunks.length ? Buffer.concat(chunks) : ((req as AppRequest & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0));
    return this.media.receiveLocal(decodeURIComponent(key), token, body, String(req.headers['content-type'] ?? 'application/octet-stream'));
  }

  @Post(':id/complete')
  @HttpCode(200)
  @SkipAudit()
  async complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.media.get(user, id);
    return this.media.complete(id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.media.get(user, id);
  }

  @Patch(':id')
  @ApiZodBody(updateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(updateSchema) body: z.infer<typeof updateSchema>) {
    return this.media.update(user, id, body);
  }

  @Post('reorder')
  @HttpCode(200)
  @ApiZodBody(reorderSchema)
  reorder(@CurrentUser() user: AuthUser, @ZBody(reorderSchema) body: z.infer<typeof reorderSchema>) {
    return this.media.reorder(user, body.ids);
  }

  @Post(':id/enhance')
  @HttpCode(200)
  @ApiZodBody(enhanceSchema)
  enhance(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(enhanceSchema) body: z.infer<typeof enhanceSchema>) {
    return this.media.enhance(user, id, body.rotateDeg);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.media.remove(user, id);
  }
}
