// src/utils/cookieUtils.js

import Cookies from 'js-cookie';

// Set a cookie
export const setCookie = (name, value, days) => {
  Cookies.set(name, value, { expires: days });
};

// Get a cookie
export const getCookie = (name) => {
  return Cookies.get(name);
};

// Remove a cookie
export const eraseCookie = (name) => {
  Cookies.remove(name);
};