import {Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtModule} from '@nestjs/jwt';
import {AxesRepository} from '../axes/axes.repository';
import {UsersModule} from '../users/users.module';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {JwtAuthGuard} from './jwt-auth.guard';

/**
 * Authentication: registration, dev-mode email confirmation, login, logout, and
 * the JWT guard. Exports the guard and JwtModule so feature modules added later
 * can protect their own routes with {@link JwtAuthGuard}.
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN')},
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AxesRepository],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
