import { RootConfigService, LoggerService } from '@backstage/backend-plugin-api';

export class ArgoCDClient {
  private constructor(
    private readonly baseUrl: string,
    private readonly authHeader: string,
    private readonly logger: LoggerService,
  ) {}

  static fromConfig(config: RootConfigService, logger: LoggerService) {
    const argocd = config.getConfig('productionRequests.argocd');
    const baseUrl = argocd.getString('baseUrl').replace(/\/$/, '');
    const token = argocd.getString('apiToken');
    const authHeader = `Bearer ${token}`;
    return new ArgoCDClient(baseUrl, authHeader, logger);
  }

  // mirrors JenkinsClient.triggerBuild: fire a sync and pass the request id
  // along via the application's `infos` so the success callback can find it.
  async sync(appName: string, params: { requestId: string }) {
    const endpoint = `${this.baseUrl}/api/v1/applications/${encodeURIComponent(appName)}/sync`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: appName,
        infos: [{ name: 'requestId', value: params.requestId }],
      }),
    });
    if (!res.ok) {
      throw new Error(
        `ArgoCD sync failed (${res.status}): ${await res.text().catch(() => '')}`,
      );
    }
    this.logger.info(
      `Triggered ArgoCD sync for app "${appName}" (requestId=${params.requestId})`,
    );
  }
}
