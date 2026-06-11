import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));

  if (userInfo?.token) {
    config.headers.Authorization = `Bearer ${userInfo.token}`;
  }

  // Inject session-unlocked passcode for message fetches to locked chats
  const messageUrlMatch = config.url.match(/\/message\/([a-f0-9]{24})/);
  if (messageUrlMatch) {
    const chatId = messageUrlMatch[1];
    const savedPasscode = sessionStorage.getItem(`lock_passcode_${chatId}`);
    if (savedPasscode) {
      config.headers["x-lock-passcode"] = savedPasscode;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("userInfo");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
