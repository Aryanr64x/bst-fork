// packages/backend/src/modules/ldapAuthExt.ts
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { ldapAuthExtensionPoint } from '@immobiliarelabs/backstage-plugin-ldap-auth-backend';

export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'ldap-ext',
  register(reg) {
    reg.registerInit({
      deps: {
        ldapAuth: ldapAuthExtensionPoint,
        catalog: catalogServiceRef,
        auth: coreServices.auth,
      },
      async init({ ldapAuth, catalog, auth }) {
        ldapAuth.set({
          resolvers: {
            async ldapAuthentication(username, _password, _options) {
              return { uid: username.toLowerCase() };
            },
            async checkUserExists(uid) {
              const credentials = await auth.getOwnServiceCredentials();
              const entity = await catalog.getEntityByRef(
                `user:default/${uid}`,
                { credentials },
              );
              return !!entity;
            },
          },
        });
      },
    });
  },
});