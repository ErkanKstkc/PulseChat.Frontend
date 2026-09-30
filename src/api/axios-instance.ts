import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const AXIOS_INSTANCE = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Access Token
AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('pulsechat_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Refresh Token on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (typeof window === 'undefined') return Promise.reject(error);

      const refreshToken = localStorage.getItem('pulsechat_refresh_token');
      const userId = localStorage.getItem('pulsechat_user_id');

      if (!refreshToken || !userId) {
        localStorage.removeItem('pulsechat_token');
        localStorage.removeItem('pulsechat_refresh_token');
        localStorage.removeItem('pulsechat_user');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => AXIOS_INSTANCE(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(`${BASE_URL}/api/Auth/refresh-token`, {
          refreshToken,
          userId,
        });

        if (refreshResponse.data?.isSuccess && refreshResponse.data?.data) {
          const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.data;
          localStorage.setItem('pulsechat_token', accessToken);
          localStorage.setItem('pulsechat_refresh_token', newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          processQueue(null);
          return AXIOS_INSTANCE(originalRequest);
        } else {
          throw new Error('Refresh token invalid');
        }
      } catch (refreshError) {
        processQueue(refreshError);
        localStorage.removeItem('pulsechat_token');
        localStorage.removeItem('pulsechat_refresh_token');
        localStorage.removeItem('pulsechat_user');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const customAxiosInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  return AXIOS_INSTANCE({
    ...config,
    ...options,
  }).then((res) => res.data);
};
