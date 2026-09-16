import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { ContractPdfService } from './contract-pdf.service';

@Module({ controllers: [OffersController], providers: [OffersService, ContractPdfService], exports: [OffersService] })
export class OffersModule {}
