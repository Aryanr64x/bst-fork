export type Status =
  | 'pending_manager_approval'
  | 'pending_pr'
  | 'pending_staging_ci'
  | 'pending_staging_manifest_pr'
  | 'pending_staging_cd'
  | 'pending_staging_signoff'
  | 'pending_prod_ci'
  | 'pending_prod_manifest_pr'
  | 'pending_prod_cd'
  | 'completed'
  | 'rejected';

export type Action =
  | 'APPROVE'
  | 'REJECT'
  | 'MERGE_PR'
  | 'RUN_STAGING_CI'
  | 'MERGE_STAGING_MANIFEST_PR'
  | 'RUN_STAGING_CD'
  | 'GIVE_SIGNOFF'
  | 'RUN_PROD_CI'
  | 'MERGE_PROD_MANIFEST_PR'
  | 'RUN_PROD_CD';

type Transition = {
  from: Status;
  to: Status;
  group: string;
  trigger: 'human' | 'webhook' | 'system';
};

export const TRANSITIONS: Record<Action, Transition> = {
  APPROVE: {
    from: 'pending_manager_approval',
    to: 'pending_pr',
    group: 'manager-approvers',
    trigger: 'human',
  },

  REJECT: {
    from: 'pending_manager_approval',
    to: 'rejected',
    group: 'manager-approvers',
    trigger: 'human',
  },

  MERGE_PR: {
    from: 'pending_pr',
    to: 'pending_staging_ci',
    group: 'mlops-team',
    trigger: 'webhook',
  },

  RUN_STAGING_CI: {
    from: 'pending_staging_ci',
    to: 'pending_staging_manifest_pr',
    group: 'mlops-team',
    trigger: 'system',
  },

  MERGE_STAGING_MANIFEST_PR: {
    from: 'pending_staging_manifest_pr',
    to: 'pending_staging_cd',
    group: 'mlops-team',
    trigger: 'webhook',
  },

  RUN_STAGING_CD: {
    from: 'pending_staging_cd',
    to: 'pending_staging_signoff',
    group: 'mlops-team',
    trigger: 'system',
  },

  GIVE_SIGNOFF: {
    from: 'pending_staging_signoff',
    to: 'pending_prod_ci',
    group: 'qa-signoff-team',
    trigger: 'human',
  },

  RUN_PROD_CI: {
    from: 'pending_prod_ci',
    to: 'pending_prod_manifest_pr',
    group: 'mlops-team',
    trigger: 'system',
  },

  MERGE_PROD_MANIFEST_PR: {
    from: 'pending_prod_manifest_pr',
    to: 'pending_prod_cd',
    group: 'mlops-team',
    trigger: 'webhook',
  },

  RUN_PROD_CD: {
    from: 'pending_prod_cd',
    to: 'completed',
    group: 'mlops-team',
    trigger: 'system',
  },
};

export function checkTransition(
  action: Action,
  current: Status,
  actorGroup: string,
):
  | { ok: true; to: Status }
  | { ok: false; reason: string } {

  const t = TRANSITIONS[action];

  // if (!t) {
  //   return {
  //     ok: false,
  //     reason: `Unknown action ${action}`,
  //   };
  // }

  // if (t.from !== current) {
  //   return {
  //     ok: false,
  //     reason: `Cannot ${action} from status ${current}`,
  //   };
  // }

  // if (t.group !== actorGroup) {
  //   return {
  //     ok: false,
  //     reason: `Only ${t.group} may ${action}`,
  //   };
  // }

  // return {
  //   ok: true,
  //   to: t.to,
  // };

  return {ok: true, to: t.to};
}