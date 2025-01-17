import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  FireFlyOptions,
  FireFlyOptionsInput,
  FireFlyCreateOptions,
  FireFlyGetOptions,
  FireFlyError,
} from './interfaces';

function isSuccess(status: number) {
  return status >= 200 && status < 300;
}

export function mapConfig(
  options: FireFlyGetOptions | FireFlyCreateOptions | undefined,
  params?: any,
): AxiosRequestConfig {
  return {
    ...options?.requestConfig,
    params: {
      ...params,
      confirm: options?.confirm,
    },
  };
}

export default class HttpBase {
  protected options: FireFlyOptions;
  protected rootHttp: AxiosInstance;
  protected http: AxiosInstance;

  private errorHandler?: (err: FireFlyError) => void;

  constructor(options: FireFlyOptionsInput) {
    this.options = this.setDefaults(options);
    this.rootHttp = axios.create({
      ...options.requestConfig,
      baseURL: `${options.host}/api/v1`,
    });
    this.http = axios.create({
      ...options.requestConfig,
      baseURL: `${options.host}/api/v1/namespaces/${this.options.namespace}`,
    });
  }

  private setDefaults(options: FireFlyOptionsInput): FireFlyOptions {
    return {
      ...options,
      namespace: options.namespace ?? 'default',
      websocket: {
        ...options.websocket,
        host: options.websocket?.host ?? options.host.replace('http', 'ws'),
        reconnectDelay: options.websocket?.reconnectDelay ?? 5000,
        heartbeatInterval: options.websocket?.heartbeatInterval ?? 30000,
      },
    };
  }

  protected async wrapError<T>(response: Promise<AxiosResponse<T>>) {
    return response.catch((err) => {
      if (axios.isAxiosError(err)) {
        const errorMessage = err.response?.data?.error;
        const ffError = new FireFlyError(errorMessage ?? err.message, err, err.request.path);
        if (this.errorHandler !== undefined) {
          this.errorHandler(ffError);
        }
        throw ffError;
      }
      throw err;
    });
  }

  protected async getMany<T>(url: string, params?: any, options?: FireFlyGetOptions, root = false) {
    const http = root ? this.rootHttp : this.http;
    const response = await this.wrapError(http.get<T>(url, mapConfig(options, params)));
    return response.data;
  }

  protected async getOne<T>(url: string, options?: FireFlyGetOptions, params?: any, root = false) {
    const http = root ? this.rootHttp : this.http;
    const response = await this.wrapError(
      http.get<T>(url, {
        ...mapConfig(options, params),
        validateStatus: (status) => status === 404 || isSuccess(status),
      }),
    );
    return response.status === 404 ? undefined : response.data;
  }

  protected async createOne<T>(url: string, data: any, options?: FireFlyCreateOptions) {
    const response = await this.wrapError(this.http.post<T>(url, data, mapConfig(options)));
    return response.data;
  }

  protected async replaceOne<T>(url: string, data: any) {
    const response = await this.wrapError(this.http.put<T>(url, data));
    return response.data;
  }

  protected async deleteOne<T>(url: string) {
    await this.wrapError(this.http.delete<T>(url));
  }

  onError(handler: (err: FireFlyError) => void) {
    this.errorHandler = handler;
  }
}
