import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {ArticlesController} from './articles.controller';
import {ArticlesRepository} from './articles.repository';

/** Article feed + card read API. */
@Module({
  imports: [AuthModule],
  controllers: [ArticlesController],
  providers: [ArticlesRepository],
})
export class ArticlesModule {}
