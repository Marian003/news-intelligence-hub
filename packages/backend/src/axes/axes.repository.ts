import {Inject, Injectable} from '@nestjs/common';
import {and, eq, inArray, sql} from 'drizzle-orm';
import {DRIZZLE, type DrizzleDb} from '../database/database.module';
import {AxisRow, axes} from '../database/schema';
import {PRESET_AXES} from './axis-presets';

export type AxisPatch = Partial<{name: string; values: string[]}>;

/** Data access for classification axes (user config; userId-scoped). */
@Injectable()
export class AxesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /** Seeds the preset axes for a new user; no-op if they already exist. */
  async seedForUser(userId: string): Promise<void> {
    await this.db
      .insert(axes)
      .values(
        PRESET_AXES.map(preset => ({
          userId,
          name: preset.name,
          values: [...preset.values],
        }))
      )
      .onConflictDoNothing();
  }

  async listByUser(userId: string): Promise<AxisRow[]> {
    return this.db
      .select()
      .from(axes)
      .where(eq(axes.userId, userId))
      .orderBy(axes.name);
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<AxisRow | undefined> {
    const rows = await this.db
      .select()
      .from(axes)
      .where(and(eq(axes.id, id), eq(axes.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async create(
    userId: string,
    input: {name: string; values: string[]}
  ): Promise<AxisRow> {
    const rows = await this.db
      .insert(axes)
      .values({userId, name: input.name, values: input.values})
      .returning();
    return rows[0];
  }

  async updateForUser(
    id: string,
    userId: string,
    patch: AxisPatch
  ): Promise<AxisRow | undefined> {
    const rows = await this.db
      .update(axes)
      .set(patch)
      .where(and(eq(axes.id, id), eq(axes.userId, userId)))
      .returning();
    return rows[0];
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(axes)
      .where(and(eq(axes.id, id), eq(axes.userId, userId)))
      .returning({id: axes.id});
    return rows.length > 0;
  }

  /** Maps axis names (as the LLM returned them) to this user's axes. */
  async findByNames(userId: string, names: string[]): Promise<AxisRow[]> {
    if (names.length === 0) return [];
    const lowered = names.map(n => n.toLowerCase());
    return this.db
      .select()
      .from(axes)
      .where(
        and(eq(axes.userId, userId), inArray(sql`lower(${axes.name})`, lowered))
      );
  }
}
