#!/bin/sh

cat <<EOF > /usr/share/nginx/html/env.js
window.__ENV__ = {
  API_URL: "${API_URL}"
};
EOF

nginx -g "daemon off;"