// axiosAuthInstance.js
import axios from 'axios';
import { getCookie } from '../cookie/Cookies';

const axiosInstance = axios.create({
  baseURL: 'https://example.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const updateAuthHeader = (token) => {
  console.log(token)
  axiosInstance.defaults.headers.common['Authorization'] =`Bearer ${token}`;
};
const token=getCookie("token")
if(token){
  updateAuthHeader(token)
}

export default axiosInstance;
