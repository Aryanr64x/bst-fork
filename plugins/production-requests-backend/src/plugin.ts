import { createBackendPlugin, coreServices } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';

import { JenkinsClient } from './jenkins/JenkinsClient';
import { RequestsStore } from './database/RequestStore';
import { createRouter } from './router';
import { GitLabClient } from './gitlab/GitlabClient';

export const productionRequestsPlugin = createBackendPlugin({
  pluginId: 'production-requests',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger:     coreServices.logger,
        database:   coreServices.database,
        config:     coreServices.rootConfig,   
        catalog:    catalogServiceRef,
        auth:       coreServices.auth,
      },
      async init({ httpRouter, logger, database, config, catalog, auth }) {
        const store         = await RequestsStore.create(database);
        // const notifier      = new Notifier(Mailer.fromConfig(config, logger), catalog, auth);
        const jenkinsClient = JenkinsClient.fromConfig(config, logger);
        const gitlabClient = GitLabClient.fromConfig(config, logger)
        httpRouter.use(await createRouter({ logger, store, jenkinsClient, gitlabClient }));

        httpRouter.addAuthPolicy({ path: '/health',                       allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/requests',                     allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/requests/:id/transition',      allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/requests/:id/events',          allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/requests/merged',              allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/events/stream',                allow: 'unauthenticated' });
      },
    });
  },
});

export default productionRequestsPlugin;