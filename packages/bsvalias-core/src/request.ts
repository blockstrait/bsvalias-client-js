'use strict';

import axios, { AxiosRequestConfig, Method, ResponseType } from 'axios';
import {
  UnexpectedBsvAliasNetworkError,
  BsvAliasServerErrorResponse,
  ConnectionTimeoutError,
} from './errors';

const DEFAULT_MAX_CONNECTION_TIMEOUT = 10000;

export interface RequestParams {
  maxConnectionTimeout?: number;
  responseType?: ResponseType;
}

export class Request {
  private readonly maxConnectionTimeout: number;
  private readonly responseType: ResponseType;

  constructor(params?: RequestParams) {
    const _params = params || {};

    this.maxConnectionTimeout = _params.maxConnectionTimeout
      ? _params.maxConnectionTimeout
      : DEFAULT_MAX_CONNECTION_TIMEOUT;

    this.responseType = _params.responseType ? _params.responseType : 'json';
  }

  private sendRequest(
    method: Method,
    url: string,
    headers?: any,
    data?: any
  ): Promise<any> {
    const requestHeaders = {
      'content-type': 'application/json',
      ...headers,
    };

    const source = axios.CancelToken.source();

    const axiosRequestConfig: AxiosRequestConfig = {
      url,
      method,
      timeout: this.maxConnectionTimeout,
      cancelToken: source.token,
      data,
      responseType: this.responseType,
      headers: requestHeaders,
      withCredentials: true,
    };

    const t = setTimeout(() => {
      source.cancel('Cancel token activated');
    }, this.maxConnectionTimeout + 1000); // let internal timer expire first

    return axios(axiosRequestConfig)
      .then(result => {
        clearTimeout(t);

        return result.data;
      })
      .catch(error => {
        clearTimeout(t);

        if (error.response) {
          throw new BsvAliasServerErrorResponse(
            error.response.status,
            error.response.data
          );
        }

        if (axios.isCancel(error) || error.code === 'ECONNABORTED') {
          throw new ConnectionTimeoutError();
        }

        throw new UnexpectedBsvAliasNetworkError(error.message);
      });
  }

  get(url: string, headers?: any): Promise<any> {
    return this.sendRequest('get', url, headers);
  }

  post(url: string, headers?: any, data?: any): Promise<any> {
    return this.sendRequest('post', url, headers, data);
  }
}
