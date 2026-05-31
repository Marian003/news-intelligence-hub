import {Inject, Injectable} from '@nestjs/common';
import {eq} from 'drizzle-orm';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {NewUserRow, UserRow, users} from '../database/schema';

/**
 * All database access for the users table. Keeping queries behind a repository
 * is the pattern the rest of the app follows: every tenant-scoped table gets a
 * repository that is the single place row ownership is enforced. (Users are the
 * tenant root, so there is no owner filter here yet.)
 */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0];
  }

  async findById(id: string): Promise<UserRow | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0];
  }

  async create(input: NewUserRow): Promise<UserRow> {
    const rows = await this.db.insert(users).values(input).returning();
    return rows[0];
  }

  /**
   * Marks the account owning this confirmation token as confirmed and clears the
   * token (single use). Returns the updated row, or undefined if no token matched.
   */
  async confirmByToken(token: string): Promise<UserRow | undefined> {
    const rows = await this.db
      .update(users)
      .set({emailConfirmed: true, confirmationToken: null})
      .where(eq(users.confirmationToken, token))
      .returning();
    return rows[0];
  }
}
