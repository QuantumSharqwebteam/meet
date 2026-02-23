// axiosInstance.js
import axios from 'axios';

const axiosAuthInstance = axios.create({
  baseURL: 'https://example.com',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  },
});

export default axiosAuthInstance;
