// packages/backend/src/modules/ldapUserTransform.ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  ldapOrgEntityProviderTransformsExtensionPoint,
  defaultUserTransformer,
} from '@backstage/plugin-catalog-backend-module-ldap';

export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'ldap-user-transform',
  register(env) {
    env.registerInit({
      deps: { ldapTransformers: ldapOrgEntityProviderTransformsExtensionPoint },
      async init({ ldapTransformers }) {
        ldapTransformers.setUserTransformer(async (vendor, config, entry) => {
          // build the standard entity first (handles displayName, email, etc.)
          const entity = await defaultUserTransformer(vendor, config, entry);
          if (!entity) return undefined;

          // override the name with the email local-part: x.y@domain -> x.y
          const email = entity.spec?.profile?.email;
          if (email) {
            entity.metadata.name = email.split('@')[0];
          }
          return entity;
        });
      },
    });
  },
});