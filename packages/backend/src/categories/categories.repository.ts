import {Inject, Injectable} from '@nestjs/common';
import {and, eq, inArray, sql} from 'drizzle-orm';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {CategoryRow, categories} from '../database/schema';

export type CategoryPatch = Partial<{name: string; color: string | null}>;

/** Data access for user categories (pure config; userId-scoped). */
@Injectable()
export class CategoriesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async listByUser(userId: string): Promise<CategoryRow[]> {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.name);
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<CategoryRow | undefined> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async create(
    userId: string,
    input: {name: string; color?: string}
  ): Promise<CategoryRow> {
    const rows = await this.db
      .insert(categories)
      .values({userId, name: input.name, color: input.color})
      .returning();
    return rows[0];
  }

  async updateForUser(
    id: string,
    userId: string,
    patch: CategoryPatch
  ): Promise<CategoryRow | undefined> {
    const rows = await this.db
      .update(categories)
      .set(patch)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    return rows[0];
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning({id: categories.id});
    return rows.length > 0;
  }

  /** Maps category names (as the LLM returned them) to this user's category ids. */
  async findByNames(userId: string, names: string[]): Promise<CategoryRow[]> {
    if (names.length === 0) return [];
    const lowered = names.map(n => n.toLowerCase());
    return this.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          inArray(sql`lower(${categories.name})`, lowered)
        )
      );
  }
}
