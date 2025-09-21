// src/lib/api.js
import axios from "axios";

// Soporta CRA (REACT_APP_) y Vite (VITE_)
export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

// Adjunta el token automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
