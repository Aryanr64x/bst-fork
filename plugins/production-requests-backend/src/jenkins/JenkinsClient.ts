import { RootConfigService, LoggerService } from '@backstage/backend-plugin-api';

export class JenkinsClient {
  private constructor(
    private readonly baseUrl: string,
    private readonly authHeader: string,
    private readonly logger: LoggerService,
  ) {}

  static fromConfig(config: RootConfigService, logger: LoggerService) {
    const jenkins = config.getConfig('productionRequests.jenkins');
    const baseUrl = jenkins.getString('baseUrl').replace(/\/$/, '');
    const user = jenkins.getString('username');
    const token = jenkins.getString('apiToken');
    const authHeader = `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
    return new JenkinsClient(baseUrl, authHeader, logger);
  }

  async triggerBuild(jobName: string, params: Record<string, string>) {
    const hasParams = Object.keys(params).length > 0;
    const endpoint = hasParams
      ? `${this.baseUrl}/job/${encodeURIComponent(jobName)}/buildWithParameters?${new URLSearchParams(params)}`
      : `${this.baseUrl}/job/${encodeURIComponent(jobName)}/build`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) {
      throw new Error(`Jenkins trigger failed (${res.status}): ${await res.text().catch(() => '')}`);
    }
    this.logger.info(
      `Triggered Jenkins job "${jobName}" ${JSON.stringify(params)} ` +
      `→ queued at ${res.headers.get('location') ?? '?'}`,
    );
  }
}