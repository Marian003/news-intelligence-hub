import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {EntitiesController} from './entities.controller';
import {EntitiesRepository} from './entities.repository';

/** Read API for canonical entities (the worker resolves/writes them). */
@Module({
  imports: [AuthModule],
  controllers: [EntitiesController],
  providers: [EntitiesRepository],
})
export class EntitiesModule {}
