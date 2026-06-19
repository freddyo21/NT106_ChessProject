import axios from "axios";
import { clearAuthSession, getAccessToken, getRefreshToken, setAuthSession } from "./authSession";

const serverApiUrl = import.meta.env.VITE_SERVER_API_URL;

const HttpClient = axios.create({
  baseURL: serverApiUrl,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  // withCredentials: true, // Phải xóa nếu không dùng cookie
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

HttpClient.interceptors.request.use(
  async (config) => {
    const publicRoutes = [
      "/auth/login",
      "/auth/register",
      "/auth/refresh",
      "/auth/logout"
    ];

    const isPublicRoute = publicRoutes.some((route) => config.url?.includes(route));

    if (!isPublicRoute) {
      // Lấy token từ nơi lưu trữ
      const accessToken = getAccessToken();
      // const token = null;

      // Nếu có token, tự động gắn vào Header Authorization
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

HttpClient.interceptors.response.use(
  (response) => response,
  async (err) => {
    // 1. Kiểm tra xem có phải lỗi của Axios không
    if (!axios.isAxiosError(err)) return Promise.reject(err);

    const originalRequest = err.config;

    if (!originalRequest) {
      return Promise.reject(err);
    }

    // 2. Kiểm tra nếu lỗi là 401 và chưa retry lần nào
    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return HttpClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
          clearAuthSession();
          return Promise.reject(err);
        }

        // Refresh token rotation returns a new user/token pair; keep local session in sync before retrying.
        const response = await HttpClient.post("/auth/refresh", { refreshToken });
        const { accessToken, refreshToken: nextRefreshToken, user } = response.data;

        setAuthSession({
          accessToken,
          refreshToken: nextRefreshToken,
          user,
        });

        processQueue(null, accessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return HttpClient(originalRequest);
      } catch (error) {
        processQueue(error, null);
        isRefreshing = false;
        clearAuthSession();
        return Promise.reject(error);
      }
    }

    return Promise.reject(err);
  }
);

export { HttpClient };
