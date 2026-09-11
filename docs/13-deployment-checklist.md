# 13. Deployment Checklist

## 13.1 Pre-Deployment

- [ ] All environment variables are set in `.env` on the server (see section 13.3)
- [ ] `.env` file is NOT committed to git (verify `.gitignore` includes `.env`)
- [ ] Database is running and accessible from the backend container
- [ ] `prisma migrate deploy` has been run on the production database
- [ ] Admin seed script has been run to create the first Admin account
- [ ] All static file upload directories (`uploads/`) exist and have write permissions
- [ ] SSL certificate is obtained (Let's Encrypt / Hostinger SSL)
- [ ] Domain DNS records point to the VPS IP

---

## 13.2 Server Setup (VPS — Docker + Nginx)

### Docker Compose Services
- `postgres` — PostgreSQL 16 database
- `backend` — Node.js/Express API server (port 4000)
- `frontend` — Nginx serving the built React app (port 80/443)

### Nginx Configuration
- Reverse proxy `/api/v1/*` to backend container on port 4000
- Serve the React build for all other routes (SPA fallback to `index.html`)
- Force HTTPS redirect (301 from HTTP to HTTPS)
- Gzip compression enabled
- Static file caching headers for JS/CSS/images

### Deployment Steps
1. SSH into VPS
2. `git pull origin main` (or `production` branch)
3. `docker compose down`
4. `docker compose up -d --build`
5. `docker exec -it backend_container npx prisma migrate deploy`
6. Verify health check endpoint: `curl https://yourdomain.com/health`
7. Run smoke tests (login, register, verify key flows)

---

## 13.3 Required Environment Variables

### Backend `.env`

```env
# Server
NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgresql://USER:PASSWORD@postgres:5432/devbridge?schema=public

# JWT
JWT_SECRET=<minimum 32 character random string>

# Email (SMTP)
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
EMAIL_FROM=DevBridge Network <noreply@yourdomain.com>

# App URL (used in email links)
APP_URL=https://yourdomain.com

# Admin Seed
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong password>

# PostgreSQL (for docker-compose)
POSTGRES_USER=devbridge
POSTGRES_PASSWORD=<strong password>
POSTGRES_DB=devbridge
```

### Frontend (build-time env for Vite)

```env
VITE_API_URL=https://yourdomain.com/api/v1
```

---

## 13.4 Post-Deployment Verification

- [ ] Public landing page loads correctly
- [ ] Register flow works (email is received)
- [ ] Login works for Developer and Admin
- [ ] Admin dashboard is accessible
- [ ] File uploads work (profile picture, resume)
- [ ] Create a test project and apply as a developer
- [ ] Payment record created successfully
- [ ] Notification delivered in-app
- [ ] SSL certificate is valid and auto-renewing
- [ ] No console errors in browser on key pages
- [ ] API returns `200` on `/health` endpoint

---

## 13.5 Rollback Plan

If a deployment fails:
1. `docker compose down`
2. `git checkout <previous stable commit>`
3. `docker compose up -d --build`
4. If database migration caused issues: `npx prisma migrate resolve --rolled-back <migration_name>`

---

## 13.6 Monitoring (Post-MVP Considerations)

The following are out of scope for MVP but recommended to set up early:
- **Uptime monitoring:** UptimeRobot (free) on the `/health` endpoint
- **Error logging:** Basic logging to files via `winston` or `pino`
- **Backup:** Daily automated PostgreSQL backup to an external storage location
