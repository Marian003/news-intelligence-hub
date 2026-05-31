import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {AxesController} from './axes.controller';
import {AxesRepository} from './axes.repository';

/** Axis management API. */
@Module({
  imports: [AuthModule],
  controllers: [AxesController],
  providers: [AxesRepository],
})
export class AxesModule {}
