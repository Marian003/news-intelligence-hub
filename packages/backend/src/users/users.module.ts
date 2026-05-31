import {Module} from '@nestjs/common';
import {UsersRepository} from './users.repository';

/** Provides user data access to other modules (currently auth). */
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
