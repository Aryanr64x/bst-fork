import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { LdapOrgEntityProvider } from '@backstage/plugin-catalog-backend-module-ldap';

export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'ldap-org-provider',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
        config: coreServices.rootConfig,
      },
      async init({ catalog, logger, scheduler, config }) {
        const provider = LdapOrgEntityProvider.fromConfig(config, {
          id: 'default',
          target: 'ldaps://10.88.1.108:636',
          logger,
          schedule: scheduler.createScheduledTaskRunner({
            frequency: { minutes: 60 },
            timeout: { minutes: 15 },
            initialDelay: { seconds: 15 },
          }),
        });
        catalog.addEntityProvider(provider);
        logger.info('LDAP org provider registered explicitly');  // <-- you WILL see this line
      },
    });
  },
});