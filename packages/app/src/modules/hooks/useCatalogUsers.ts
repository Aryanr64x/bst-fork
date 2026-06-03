import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { MockUser } from '../../interfaces.ts'


export function useCatalogUsers() {
  const catalogApi = useApi(catalogApiRef);
  const [users, setUsers] = useState<MockUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'User' },
        });

        const mapped: MockUser[] = items.map(entity => {
          // the group(s) this user is a memberOf, from the relation the catalog computed
          const group =
            entity.relations
              ?.find(r => r.type === 'memberOf')
              ?.targetRef.split('/')
              .pop() ?? 'unknown';

          const profile = (entity.spec as any)?.profile ?? {};
          return {
            id: entity.metadata.name,                 // e.g. "pramod.reddy"
            name: profile.displayName ?? entity.metadata.name,
            email: profile.email ?? '',
            group,                                     // e.g. "chat-api-team"
            label: `${profile.displayName ?? entity.metadata.name} (${group})`,
          };
        });

        if (!cancelled) setUsers(mapped);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogApi]);

  return { users, loading };
}