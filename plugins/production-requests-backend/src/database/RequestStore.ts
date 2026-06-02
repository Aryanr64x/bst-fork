import { DatabaseService } from '@backstage/backend-plugin-api';
import { Status } from '../workflow';

// the Knex type, taken from whatever getClient() returns — no direct 'knex' import
type KnexClient = Awaited<ReturnType<DatabaseService['getClient']>>;

async function ensureSchema(knex: KnexClient) {
  if (!(await knex.schema.hasTable('production_requests'))) {
    await knex.schema.createTable('production_requests', t => {
      t.uuid('id').primary();
      t.string('api_ref').notNullable();
      t.string('title').notNullable();
      t.string('change_type').notNullable()
      t.string('branch').notNullable()
      t.string('issue_id').notNullable()
      t.string('issue_link').notNullable()
      // application repo PR
      t.string('pr_link').notNullable();
      // manifest repo PRs
      t.string('staging_manifest_pr_link').nullable();
      t.string('prod_manifest_pr_link').nullable();
      t.text('description');
      t.string('requested_by').notNullable();
      t.string('status').notNullable();
      t.timestamp('created_at').notNullable();
      t.timestamp('updated_at').notNullable();
    });
  }

  // TEMP DEV MIGRATION SUPPORT
  // remove later when proper knex migrations are added

  const hasStagingManifestPrLink = await knex.schema.hasColumn(
    'production_requests',
    'staging_manifest_pr_link',
  );

  if (!hasStagingManifestPrLink) {
    await knex.schema.alterTable('production_requests', t => {
      t.string('staging_manifest_pr_link').nullable();
    });
  }

  const hasProdManifestPrLink = await knex.schema.hasColumn(
    'production_requests',
    'prod_manifest_pr_link',
  );

  if (!hasProdManifestPrLink) {
    await knex.schema.alterTable('production_requests', t => {
      t.string('prod_manifest_pr_link').nullable();
    });
  }

  if (!(await knex.schema.hasTable('production_request_events'))) {
    await knex.schema.createTable('production_request_events', t => {
      t.increments('id').primary();

      t.uuid('request_id')
        .notNullable()
        .references('id')
        .inTable('production_requests');

      t.string('actor').notNullable();

      t.string('action').notNullable();

      t.string('from_status');

      t.string('to_status').notNullable();

      t.text('comment');

      t.timestamp('created_at').notNullable();
    });
  }
}
  
const toDto = (row: any) => ({
  id: row.id,
  apiRef: row.api_ref,
  title: row.title,
  prLink: row.pr_link,
  issueId: row.issue_id,
  issueLink: row.issue_link,
  branch: row.branch,
  change_type: row.change_type,
  stagingManifestPrLink: row.staging_manifest_pr_link,
  prodManifestPrLink: row.prod_manifest_pr_link,
  description: row.description,
  requestedBy: row.requested_by,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class RequestsStore {
  private constructor(private readonly knex: KnexClient) {}

  static async create(database: DatabaseService) {
    const knex = await database.getClient();

    await ensureSchema(knex);

    return new RequestsStore(knex);
  }

  async list(apiRef?: string) {
    const q = this.knex('production_requests')
      .orderBy('created_at', 'desc');

    if (apiRef) {
      q.where('api_ref', apiRef);
    }

    return (await q).map(toDto);
  }

  async getById(id: string) {
    const row = await this.knex('production_requests')
      .where('id', id)
      .first();

    return row ? toDto(row) : undefined;
  }

  async insert(input: {
    apiRef: string;
    title: string;
    prLink: string;
    branch: string;
    changeType: string;
    issueId: string;
    issueLink: string;
    description?: string;
    requestedBy: string;
  }) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await this.knex('production_requests').insert({
      id,
      api_ref: input.apiRef,
      title: input.title,
      branch: input.branch,
      change_type: input.changeType,
      issue_id: input.issueId,
      issue_link: input.issueLink,
      pr_link: input.prLink,
      staging_manifest_pr_link: null,
      prod_manifest_pr_link: null,
      description: input.description ?? null,
      requested_by: input.requestedBy,
      status: 'pending_manager_approval',
      created_at: now,
      updated_at: now,
    });

    await this.knex('production_request_events').insert({
      request_id: id,
      actor: input.requestedBy,
      action: 'SUBMIT',
      from_status: null,
      to_status: 'pending_manager_approval',
      created_at: now,
    });

  return (await this.getById(id))!;
}

  async applyTransition(
    id: string,
    to: Status,
    event: {
      actor: string;
      action: string;
      fromStatus: string;
      comment?: string;
    },
  ) {
    const now = new Date().toISOString();

    await this.knex.transaction(async trx => {
      await trx('production_requests')
        .where('id', id)
        .update({
          status: to,
          updated_at: now,
        });

      await trx('production_request_events').insert({
        request_id: id,

        actor: event.actor,

        action: event.action,

        from_status: event.fromStatus,

        to_status: to,

        comment: event.comment ?? null,

        created_at: now,
      });
    });

    return (await this.getById(id))!;
  }

  async updateManifestPrLinks(
    id: string,
    input: {
      stagingManifestPrLink?: string;
      prodManifestPrLink?: string;
    },
  ) {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.stagingManifestPrLink !== undefined) {
      updatePayload.staging_manifest_pr_link =
        input.stagingManifestPrLink;
    }

    if (input.prodManifestPrLink !== undefined) {
      updatePayload.prod_manifest_pr_link =
        input.prodManifestPrLink;
    }

    await this.knex('production_requests')
      .where('id', id)
      .update(updatePayload);

    return (await this.getById(id))!;
  }

  async getEvents(requestId: string) {
    const rows = await this.knex('production_request_events')
      .where('request_id', requestId)
      .orderBy('id', 'asc');

    return rows.map(r => ({
      id: r.id,

      actor: r.actor,

      action: r.action,

      fromStatus: r.from_status,

      toStatus: r.to_status,

      comment: r.comment,

      createdAt: r.created_at,
    }));
  }
}