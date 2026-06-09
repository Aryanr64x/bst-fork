import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { ldapAuthExtensionPoint } from '@immobiliarelabs/backstage-plugin-ldap-auth-backend';

export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'ldap-ext',
  register(reg) {
    reg.registerInit({
      deps: { config: coreServices.rootConfig, ldapAuth: ldapAuthExtensionPoint },
      async init({ ldapAuth }) {
        ldapAuth.set({
          resolvers: {
            async ldapAuthentication(username, password, options) {
              return { uid: username.split('@')[0] };
            },
            async checkUserExists() {
              return true;
            },
          },
        });
      },
    });
  },
});