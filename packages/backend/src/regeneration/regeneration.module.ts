import {Module} from '@nestjs/common';
import {ArticlesRepository} from '../articles/articles.repository';
import {AuthModule} from '../auth/auth.module';
import {RegenerationController} from './regeneration.controller';
import {RegenerationService} from './regeneration.service';

/** Regeneration API (the worker does the actual re-analysis via the queue). */
@Module({
  imports: [AuthModule],
  controllers: [RegenerationController],
  providers: [RegenerationService, ArticlesRepository],
})
export class RegenerationModule {}
