import axios from "axios";

const http = axios.create({ baseURL: "/api" });
let accessToken = null;
let authErrorCb = null;

export function setAccessToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem("erp_token", token);
    http.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    localStorage.removeItem("erp_token");
    delete http.defaults.headers.common["Authorization"];
  }
}

export function onAuthError(cb) {
  authErrorCb = cb;
}

http.interceptors.request.use((config) => {
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      setAccessToken(null);
      if (authErrorCb) authErrorCb();
    }
    return Promise.reject(err.response?.data || err);
  }
);

const savedToken = localStorage.getItem("erp_token");
if (savedToken) {
  setAccessToken(savedToken);
}

export { http };
