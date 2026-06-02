import { RootConfigService, LoggerService } from '@backstage/backend-plugin-api';

export class GitLabClient {
  private constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly issueProject: string,   
    private readonly logger: LoggerService,
  ) {}

  static fromConfig(config: RootConfigService, logger: LoggerService) {
    const gitlab = config.getConfig('productionRequests.gitlab');
    const baseUrl = (gitlab.getOptionalString('baseUrl') ?? 'https://gitlab.com').replace(/\/$/, '');
    const token = gitlab.getString('apiToken');
    const issueProject = gitlab.getString('issueProject');
    return new GitLabClient(baseUrl, token, issueProject, logger);
  }

  async createIssue(input: {
    title: string;
    description?: string;
  }): Promise<{ iid: string; url: string }> {
    const encoded = encodeURIComponent(this.issueProject);
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${encoded}/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'PRIVATE-TOKEN': this.token },
      body: JSON.stringify({
        title: input.title,
        description: input.description ?? '',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`createIssue failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    this.logger.info(`Created issue !${data.iid} in ${this.issueProject}`);
    return { iid: String(data.iid), url: data.web_url as string };
  }
}