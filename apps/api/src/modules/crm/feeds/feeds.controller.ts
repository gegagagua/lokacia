import { Controller, Get, Headers, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public, SkipAudit } from '../../../common/decorators';
import { problems } from '../../../common/problem';
import { FeedsService } from './feeds.service';

/** C9: public XML feed `GET /v1/feeds/:orgId.xml` for other portals. */
@ApiTags('feeds')
@Controller('v1/feeds')
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Public()
  @SkipAudit()
  @Get(':file')
  async feed(@Param('file') file: string, @Headers('if-none-match') ifNoneMatch: string | undefined, @Res() res: Response) {
    const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.xml$/i.exec(file);
    if (!m) throw problems.notFound('ფიდი');
    const out = await this.feeds.get(m[1]!.toLowerCase());
    if (!out) throw problems.notFound('ფიდი');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.setHeader('ETag', out.etag);
    res.setHeader('X-Cache', out.cached ? 'HIT' : 'MISS');
    if (ifNoneMatch && ifNoneMatch === out.etag) {
      res.status(304).end();
      return;
    }
    res.status(200).type('application/xml; charset=utf-8').send(out.xml);
  }
}
