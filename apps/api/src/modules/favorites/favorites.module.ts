import { Module } from '@nestjs/common';
import { CompareController, FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

/** Favorites & comparison tables with share links (P14). */
@Module({ controllers: [FavoritesController, CompareController], providers: [FavoritesService], exports: [FavoritesService] })
export class FavoritesModule {}
