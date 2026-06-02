import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {DigestsController} from './digests.controller';
import {DigestsRepository} from './digests.repository';
import {DigestsService} from './digests.service';

/**
 * Digest API (the worker builds them via the digest queue). The DIGEST_QUEUE
 * producer comes from the global QueueModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [DigestsController],
  providers: [DigestsService, DigestsRepository],
})
export class DigestsModule {}
