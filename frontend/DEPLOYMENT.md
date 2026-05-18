# Deployment Infrastructure

## Hostinger VPS - Coolify Instance

### SSH Access
```bash
ssh root@31.220.63.174
```

**Server Details:**
- **Provider:** Hostinger VPS
- **OS:** Ubuntu 24.04.4 LTS (Noble Numbat)
- **Kernel:** 6.8.0-111-generic
- **IPv4:** 31.220.63.174
- **IPv6:** 2a02:4780:10:63da::1

### Coolify Installation

**Installed:** 2026-05-18 02:36:18 UTC
**Version:** 4.0.0
**Access URL:** http://31.220.63.174:8000

**Components:**
- Docker 29.5.0
- Coolify Helper 1.0.13
- Coolify Realtime 1.0.13
- PostgreSQL 15 (Alpine)
- Redis 7 (Alpine)

**Configuration Location:**
- Coolify data: `/data/coolify/source/`
- Environment file: `/data/coolify/source/.env`
- Docker compose: `/data/coolify/source/docker-compose.yml`
- Installation log: `/data/coolify/source/installation-20260518-023618.log`
- Environment backup: `/Users/jeffignacio/coolify-env-backup.txt`

**Coolify Credentials:**
- App ID: `1d0b51df95e148bd20b686f2c35bff26`
- DB Password: `hr1OWaYhPAO/Z2RNPbpEEhpRznS0lblwQoh7jcWBf7I=`
- Redis Password: `r0Rgb4NPj2p77puNQO6sOtcIas39uDZMM50hAiYcYt4=`
- Upstash Redis: `master-sunfish-128407.upstash.io`

### Useful Commands

**Check Coolify status:**
```bash
ssh root@31.220.63.174 'docker ps'
```

**View Coolify logs:**
```bash
ssh root@31.220.63.174 'docker logs coolify'
```

**Restart Coolify:**
```bash
ssh root@31.220.63.174 'cd /data/coolify/source && docker compose restart'
```

**View environment variables:**
```bash
ssh root@31.220.63.174 'cat /data/coolify/source/.env'
```

**Backup environment file:**
```bash
ssh root@31.220.63.174 'cat /data/coolify/source/.env' > coolify-env-backup-$(date +%Y%m%d).txt
```

### Firewall Configuration (If Needed)

```bash
ssh root@31.220.63.174 'ufw allow 8000/tcp && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable'
```

### Environment Variables for Worker Deployment

**Required for Always On Digest Worker:**

```bash
# Upstash Redis (BullMQ queue)
# Already configured - master-sunfish-128407.upstash.io
UPSTASH_REDIS_URL="rediss://default:gQAAAAAAAfWXAAIgcDI1NTU0ZTk3OWNiMmQ0Nzk0YmQyYWU3ODBlNDhkODY1Ng@master-sunfish-128407.upstash.io:6379"

# Supabase Database (use SERVICE ROLE KEY, not anon key!)
# Get from: Supabase project settings → API → service_role key
SUPABASE_URL=https://iidsiejbhdpzzmbotybw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-service-role-key

# Resend Email (for digest emails)
# Get from: https://resend.com/api-keys
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Refyne <noreply@refyne.io>"

# Always On - Unsubscribe token secret
# Generate a random 32+ character string
UNSUBSCRIBE_SECRET=your-random-secret-string

# Application URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**⚠️ IMPORTANT:**
- ❌ **DON'T** use `redis://localhost:6379` - This is local Redis, not Upstash
- ✅ **DO** use `rediss://...` from Upstash dashboard
- ❌ **DON'T** use `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key has limited permissions
- ✅ **DO** use `SUPABASE_SERVICE_ROLE_KEY` - Worker needs full database access

### Planned Deployments

**Services to deploy on Coolify:**
1. **Always On Digest Worker** - Background job processor
   - Dockerfile: `frontend/Dockerfile.worker`
   - Type: Worker service (long-running process)
   - No port mapping needed
   - Environment: See "Environment Variables" section above

2. **Next.js Frontend** - Web application
   - Port: 3000
   - Build: `npm run build`
   - Start: `npm start`
   - Type: Web service

3. **Upstash Redis** (External)
   - Already using: Redis Cloud for BullMQ queue
   - No deployment needed on Coolify

4. **Supabase** (External)
   - Already using: Supabase hosted database
   - No deployment needed on Coolify

### Network Configuration

**Docker Network Pool:**
- Base: 10.0.0.0/8
- Size: 24

**Private IPs:**
- 10.0.0.1
- 10.0.1.1
- 2a02:4780:10:63da::1
- fdc5:19fd:2f94::1

---

*Last updated: 2026-05-18*
