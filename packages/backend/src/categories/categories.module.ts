import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module';
import {CategoriesController} from './categories.controller';
import {CategoriesRepository} from './categories.repository';

/** Category management API. */
@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
  providers: [CategoriesRepository],
})
export class CategoriesModule {}
