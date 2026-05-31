import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {FeedsController} from './feeds.controller';
import {FeedsRepository} from './feeds.repository';
import {FeedsService} from './feeds.service';

/**
 * Feed management. Imports AuthModule for the JWT guard. FeedsRepository is
 * exported so the polling worker (added later) can update feed status.
 */
@Module({
  imports: [AuthModule],
  controllers: [FeedsController],
  providers: [FeedsService, FeedsRepository],
  exports: [FeedsRepository],
})
export class FeedsModule {}
