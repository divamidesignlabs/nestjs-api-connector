import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { TargetApiConfig } from '../interfaces/mapping-config.interface';

@Injectable()
export class TargetApiCaller {
  private readonly logger = new Logger(TargetApiCaller.name);

  constructor(private readonly httpService: HttpService) {}

  async call(
    config: TargetApiConfig,
    payload: any,
    headers: Record<string, string> = {},
  ): Promise<any> {
    const requestConfig = {
      method: config.method,
      url: config.url,
      data: payload as Record<string, any>,
      headers: { ...config.headers, ...headers },
      params: config.queryParams, // Inject query params from config
    };

    this.logger.debug(
      `Calling Target API: ${requestConfig.method} ${requestConfig.url}`,
    );
    this.logger.debug(`Request Config: ${JSON.stringify({
      params: requestConfig.params,
      headers: requestConfig.headers
    })}`);

    try {
      const response = await firstValueFrom(
        this.httpService.request<any>(requestConfig),
      );
      return response.data;
    } catch (error: any) {
      const axiosError = error as {
        message?: string;
        response?: { data: any };
      };
      this.logger.error(
        `Target API call failed: ${axiosError.message || 'Unknown error'}`,
        axiosError.response?.data,
      );
      throw error;
    }
  }
}
