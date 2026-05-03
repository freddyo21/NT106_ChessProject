import axios from "axios";

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
      const accessToken = localStorage.getItem("accessToken");
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
        // Gọi API để làm mới token
        const response = await HttpClient.post("/auth/refresh");
        const { accessToken } = response.data;

        processQueue(null, accessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return HttpClient(originalRequest);
      } catch (error) {
        processQueue(error, null);
        isRefreshing = false;
        return Promise.reject(error);
      }
    }

    return Promise.reject(err);
  }
);

export { HttpClient };